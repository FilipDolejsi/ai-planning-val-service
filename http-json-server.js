// @ts-check
import { parser, Happening, HappeningType } from 'pddl-workspace';
import { ValStep, ValueSeq, Parser } from 'ai-planning-val';
import vscodeUri from 'vscode-uri'
import http from 'http';

var server = http.createServer(function (request, response) {
    var allData = "";
    request.on('data', async function (data) {
        allData += data;
    });
    request.on('end', async function () {
        console.log('Client request ended');
        var info = JSON.parse(allData.toString());
        // console.log('Client sent: %j', info);
        // clientName = info.name;
        var domainText=info.domain;
        const domain = parser.PddlDomainParser.parseText(domainText, vscodeUri.URI.file('domain'));
        var problemText=info.problems[0];
        const problem = await parser.PddlProblemParser.parseText(problemText, vscodeUri.URI.file('problem'));
        var parserPath = ".\\val_binaries\\Val-20210203.2-win64\\bin\\Parser.exe"
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

console.log('Service is listening at :8085');
server.listen(8085, 'localhost');

server.on('connection', (stream) => {
    console.log('someone connected!');
});
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

