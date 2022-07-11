// @ts-check
import { parser, Happening, HappeningType } from 'pddl-workspace';
import { ValStep, ValueSeq, Parser } from 'ai-planning-val';
import vscodeUri from 'vscode-uri'
import http from 'http';

var server = http.createServer(function (request, response) {
    var clientName;
    request.on('data', async function (data) {
        var info = JSON.parse(data.toString());
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
            parsingProblems.forEach((issues, fileUri) => {
                console.log(`Parsing problems in ${fileUri}`);
                issues.forEach(issue => console.log(`At line: ${issue.range.start.line} ${issue.severity}: ${issue.problem}`))
            });    
        } catch (error) {
            console.error(error);
        }
    });
    request.on('end', function () {
        console.log('Client request ended');
        response.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
        });
        response.write(JSON.stringify([
            {
              "location": "DOMAIN",
              "position": {
                "line": 10,
                "column": 0
              },
              "severity": "WARNING",
              "issue": "Undeclared requirement :negative-preconditions",
              "message": "Declare :negative-preconditions"
            }
          ]));
        response.end();
        console.log('Response sent');
    });
});

console.log('Service is listening at :8085');
server.listen(8085, 'localhost');

server.on('connection', (stream) => {
    console.log('someone connected!');
});
