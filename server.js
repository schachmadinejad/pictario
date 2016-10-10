var http = require('http'),
    url = require('url'),
    WebSocketServer = require('ws').Server,
    filehandling = require('filehandling'),
    log = require('logger'),
    clienthandler = require('user');

/**
 * Our server for accepting file requests.
 */
http.createServer(function(req, res) {
  filehandling.sendFile(res, url.parse(req.url).pathname);
}).listen(8080, 'localhost');


var coms = new WebSocketServer({port: '9090'}); // The server for accepting command sockets.

/**
 * Accepts client connection and initializes it.
 */
coms.on('connection', function connection(com) {
  clienthandler.addClient(com);
  /**
   * On connection close remove client from client array.
   */
  com.on('close', function disconnect() {
    clienthandler.deleteClient(com);
  });

  /**
   * If a message (command) arrives, broadcast to all clients.
   */
  com.on('message', function incoming(data, flags) {
    clienthandler.handleCommand(com, JSON.parse(data));
  });
});


console.log("Server running");
