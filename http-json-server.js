var http = require('http');
var fs = require('fs');
var server = http.createServer(function (request, response) {
    var clientName;
    request.on('data', function (data) {
        var info = JSON.parse(data.toString());
        console.log('Client sent: %j', info);
        clientName = info.name;
    });
    request.on('end', function () {
        console.log('Client rquest ended');
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify({ hello: clientName }));
        response.end();
        console.log('Response sent');
    });
});
server.listen(8085, 'localhost');
