// @ts-check
import { parser, Happening, HappeningType } from 'pddl-workspace';
import { ValStep, ValueSeq, Parser } from 'ai-planning-val';
import vscodeUri from 'vscode-uri'
import http from 'http';
import fs from 'fs';
import path from 'path';
import express from 'express';

var app = express();
var valLocation = path.join("val_binaries", "val.json");
var valBinariesText = fs.readFileSync(valLocation, { encoding: "utf-8" });
var parserExe = JSON.parse(valBinariesText).parserPath;
var parserPath = path.join("val_binaries", parserExe);

var valStepExe = JSON.parse(valBinariesText).valStepPath;
var valStepDir = path.join("val_binaries", valStepExe);
console.log(parserPath);

app.post('/parse', function (request, response) {
    var allData = "";
    request.on('data', async function (data) {
        allData += data;
    });
    request.on('end', async function () {
        console.log('Client request ended');
        var info = JSON.parse(allData.toString());
        var domainText=info.domain;
        const domain = parser.PddlDomainParser.parseText(domainText, vscodeUri.URI.file('domain'));
        var problemText=info.problems[0];
        const problem = await parser.PddlProblemParser.parseText(problemText, vscodeUri.URI.file('problem'));
        const pddlParser = new Parser({ executablePath : parserPath });
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
            response.write(JSON.stringify(
                allProblems
              ));
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


app.post('/evaluation', async function (request, response) {
    console.log("Got a POST request for the homepage");
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

        const valStep = new ValStep(domain, problem);
        try {
    
            var valuesAtEnd = await valStep.executeBatch(allHappenings, {
                valStepPath: valStepDir,
                verbose: false
            })

            // check for undefined; return some failure state

            console.log(`Values at end: ` +
                valuesAtEnd
                    .map(v => `${v.getVariableName()}=${v.getValue()}`)
                    .join(', '));
        
            response.send(`Values at end: ` +
            valuesAtEnd
                .map(v => `${v.getVariableName()}=${v.getValue()}`)
                .join(', '));
        
        } catch (error) {
            console.error(error);
            response.send(error.message);
        }
    
    })
})

 var server = app.listen(8081, function () {
    var host = server.address().address
    var port = server.address().port
    
    console.log("Example app listening at http://%s:%s", host, port)
 })

function toProblem(issue, fileUri) {
    var fileType;
    if (fileUri.includes('domain')){
        fileType = "DOMAIN";
    } else if (fileUri.includes('problem')){
        fileType = "PROBLEM:0";//todo:generalise the 0
    }
    var line = issue.range.start.line+1;
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
