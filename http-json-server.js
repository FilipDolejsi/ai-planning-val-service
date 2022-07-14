// @ts-check
import { parser, Happening, Plan, VariableValue, ParsingProblem, PddlRange } from 'pddl-workspace';
import { ValStep, Parser, PlanEvaluator, PlanFunctionEvaluator, GroundedFunctionValues } from 'ai-planning-val';
import vscodeUri from 'vscode-uri'
import fs from 'fs';
import path from 'path';
import express from 'express';

var app = express();
const valBinariesDir = "val_binaries";
var valLocation = path.join(valBinariesDir, "val.json");
var valBinariesText = fs.readFileSync(valLocation, { encoding: "utf-8" });
const valBinaries = JSON.parse(valBinariesText);

var parserPath = path.join(valBinariesDir, valBinaries.parserPath);
var valStepDir = path.join(valBinariesDir, valBinaries.valStepPath);
var valueSeqPath = path.join(valBinariesDir, valBinaries.valueSeqPath);

console.log(parserPath);

app.post('/parse', function (request, response) {
    var allData = "";
    request.on('data', async function (data) {
        allData += data;
    });
    request.on('end', async function () {
        console.log('Client request ended');
        var info = JSON.parse(allData.toString());
        var domainText = info.domain;
        const domain = parser.PddlDomainParser.parseText(domainText, vscodeUri.URI.file('domain'));
        var problemText = info.problems[0];
        const problem = await parser.PddlProblemParser.parseText(problemText, vscodeUri.URI.file('problem'));
        const pddlParser = new Parser({ executablePath: parserPath });
        try {
            const parsingProblems = await pddlParser.validate(domain, problem);
            var allProblems = [];
            parsingProblems.forEach((issues, fileUri) => {
                console.log(`Parsing problems in ${fileUri}`);
                issues.forEach(issue => console.log(`At line: ${issue.range.start.line} ${issue.severity}: ${issue.problem}`))
                issues.forEach(issue => allProblems.push(toProblem(issue, fileUri)));
            });
            response.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
            });
            response.json(allProblems);
        } catch (error) {
            console.error(error);
            response.writeHead(500, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
            });
            response.write(JSON.stringify([
                {
                    "status": 0,
                    "error": "string",
                    "message": "string",
                    "timestamp": "2022-07-11T18:32:19.342Z",
                    "trace": "string"
                }
            ]));
        }
        response.end();
        console.log('Response sent');
    });
});


const VALIDATION = 'validation';
const PLAN_HAPPENINGS_EFFECT_EVALUATION = 'plan-happenings-effect-evaluation';
const FINAL_STATE_VALUES = 'final-state-evaluation';
const NUMERIC_FUNCTION_VALUES = 'plan-function-evaluation';
const ALL_EVALUATIONS = [
    VALIDATION,
    PLAN_HAPPENINGS_EFFECT_EVALUATION,
    FINAL_STATE_VALUES,
    NUMERIC_FUNCTION_VALUES
];
const HEADER_NAME = 'evaluations';

console.log(`Available evaluations: ${HEADER_NAME}: ${ALL_EVALUATIONS.join(',')}`);

app.post('/evaluation', async function (request, response) {
    const requestedEvaluations = request.headers[HEADER_NAME] ?? ALL_EVALUATIONS.join(',');
    console.log(`/evaluation with headers: ${requestedEvaluations}`);

    var allData = "";
    request.on('data', async function (data) {
        allData += data;
    });

    request.on('end', async function () {
        var info = JSON.parse(allData.toString());
        var domainText = info.domain;
        const domain = parser.PddlDomainParser.parseText(domainText);
        var problemText = info.problem;
        const problem = await parser.PddlProblemParser.parseText(problemText);
        var planText = info.plan;
        const plan = new parser.PddlPlanParser().parseText(planText, 0.001);
        const allHappenings = plan.getHappenings();

        const responseBody = {};

        if (requestedEvaluations.includes(VALIDATION)) {
            /** @type {ParsingProblem[]} */
            const mockValidationProblems = [
                new ParsingProblem("Some validation error", "error", PddlRange.createFullLineRange(4))
            ];

            responseBody[VALIDATION] = {
                error: "Plan validation not yet supported.", // optional field
                problems: mockValidationProblems.map(p => toProblem(p, undefined))
            };
        }

        if (requestedEvaluations.includes(PLAN_HAPPENINGS_EFFECT_EVALUATION)) {
            const valStep = new ValStep(domain, problem);
            try {

                /** @type HappeningsValues[] */
                const happeningsValues = [];

                valStep.onStateUpdated((happenings, values) => {
                    happeningsValues.push(new HappeningsValues(happenings, values));
                });

                var valuesAtEnd = await valStep.executeIncrementally(allHappenings, {
                    valStepPath: valStepDir,
                    verbose: false
                })

                responseBody[PLAN_HAPPENINGS_EFFECT_EVALUATION] = happeningsValues;
                // check for undefined; return some failure state

                console.log(`Values at end: ` +
                    valuesAtEnd
                        .map(v => `${v.getVariableName()}=${v.getValue()}`)
                        .join(', '));


            } catch (error) {
                console.error(error);
                response.send(error.message);
            }
        }
        if (requestedEvaluations.includes(FINAL_STATE_VALUES)) {
            const planEvaluator = new PlanEvaluator();
            const finalState = await planEvaluator.evaluate(domain, problem, plan, { valStepPath: valStepDir });
            console.log(JSON.stringify(finalState, null, 2));
            responseBody[FINAL_STATE_VALUES] = finalState;
        }
        if (requestedEvaluations.includes(NUMERIC_FUNCTION_VALUES)) {
            const planObj = new Plan(plan.getSteps(), domain, problem);
            const planEvaluator = new PlanFunctionEvaluator(planObj, {
                valueSeqPath: valueSeqPath, valStepPath: valStepDir, shouldGroupByLifted: true
            });

            const functionValues = await planEvaluator.evaluate();

            var allVariableValues = {};
            // print out the data for each graph
            functionValues.forEach((variableValues, variable) => {
                allVariableValues[variable.getFullName()] = toVariableValuesResponse(variableValues);
            })

            responseBody[NUMERIC_FUNCTION_VALUES] = allVariableValues;
            console.log(allVariableValues);
        }

        console.log(responseBody)
        response.json(responseBody);
    })
})

/**
 * Converts to response.
 * @param {GroundedFunctionValues} variableValues 
 * @returns response structure
 */
function toVariableValuesResponse(variableValues) {
    return {
        "variable": variableValues.liftedVariable.getFullName(),
        "values": JSON.stringify(variableValues.values),
        "legend": variableValues.legend
    };
}

var server = app.listen(8081, function () {
    var host = server.address().address
    var port = server.address().port

    console.log("Example app listening at http://%s:%s", host, port)
})

/**
 * @param {ParsingProblem} issue
 * @param {string?} fileUri
 */
function toProblem(issue, fileUri) {
    var fileType;
    if (fileUri?.includes('domain')) {
        fileType = "DOMAIN";
    } else if (fileUri?.includes('problem')) {
        fileType = "PROBLEM:0";//todo: generalize the '0'
    }
    var line = issue.range.start.line + 1;
    var character = issue.range.start.character;
    var problem = issue.problem;
    var severity = issue.severity;
    return {
        "location": fileType,
        "position": {
            "line": line,
            "column": character
        },
        "severity": severity,
        "issue": problem,
        "message": problem
    };
}


class HappeningsValues {

    /** @type Happening[]*/
    happenings;
    /** @type VariableValue[]*/
    values;

    /**
     * Constructs
     * @param {Happening[]} happenings 
     * @param {VariableValue[]} values 
     */
    constructor(happenings, values) {
        this.happenings = happenings;
        this.values = values;
    }
}