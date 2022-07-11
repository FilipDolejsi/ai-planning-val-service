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
        console.log('Client request ended');
        response.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
        });
        response.write(JSON.stringify({ hello: clientName }));
        response.end();
        console.log('Response sent');
    });
});

console.log('Service is listening at :8085');
server.listen(8085, 'localhost');

server.on('connection', (stream) => {
    console.log('someone connected!');
});
