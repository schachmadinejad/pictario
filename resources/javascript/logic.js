var canvas; //holds the canvas for drawing
var context;  //holds the context for manipulationg the canvas
var com;  //the socket for sending and receiving commands
var variables = {}; //variables
var predefined = {
  'pencil': {'strokeStyle': 'black', 'lineWidth': 1},
  'crayon': {'strokeStyle': 'black', 'lineWidth': 5},
  'erase': {'strokeStyle': 'white', 'lineWidth': 5}
};

/**
 * This function initializes our page once it is fully loaded.
 */
document.addEventListener('DOMContentLoaded', function(e) {
  canvas = document.getElementById('picture');
  context = canvas.getContext('2d');
  resizeCanvas(); //sets initial size for our canvas depending on the window size
  com = new WebSocket('ws://localhost:9090'); //tries to establish a socket with the server

  com.addEventListener('message', receivedCommand); //binds our function for handling incomming communication
});
var clicks = {x: [], y: []};  //our arry for our own clicks (of one path)

/**
 * Handles the mouseDown event, which starts a line.
 */
function startPainting() {
  addClick(event.pageX - context.canvas.offsetLeft, event.pageY - context.canvas.offsetTop);  //adds a point to the path
}

/**
 * Handles the mouseMove event, which continues a line (if button is clicked)
 */
function doPaint() {
  if (clicks.x.length > 0) {  //if no points added, button is not clicked
    addClick(event.pageX - context.canvas.offsetLeft, event.pageY - context.canvas.offsetTop);  //adds a point to the path
  }
}

/**
 * Handles both the mouseLeave and mouseButtonUp event, which end the drawing of a line.
 */
function stopPainting() {
  clicks = {x: [], y: []} //resets clicks. this is important because this way we know that move should not add points
}

/**
 * Adds the coordinates for our click, and sends the command to the server.
 * @param {number} x The x-Coordinate of the click.
 * @param {number} y The y-Coordinate of the click.
 */
function addClick(x, y) {
  clicks.x.push(x);
  clicks.y.push(y);

  sendStroke(clicks.x.length-1);  //this function handles sending paint commands to the server
}

/**
 * This section is for all tool function.
 */

/**
 * Sets the stroke style for all line tools.
 */
function setLine() {
  var settings = predefined[event.srcElement.id];
  if (settings === undefined) {
    console.error('User tried to access undefined line tool ' + event.srcElement.id + '.');
  }
  context.strokeStyle = settings.strokeStyle;
  context.lineWidth = settings.lineWidth;
}

/**
 * Sets the background to a color (default: black).
 */
function sendBackground(fillStyle = 'black') {
  var back = {};
  back.type = 'background';
  back.fillStyle = fillStyle;
  com.send(JSON.stringify(back));
}

/**
 * Resizes the canvas according to the div it is in.
 * @param {png=} snapshot A snapshot of the canvas to which to restore to.
 */
function resizeCanvas(snapshot) {
  var painter = document.getElementById('painter'); //the containing div
  var canvas = document.getElementById('picture');  //the canvas element
  //sets variables for later use (e.g. normalizing coordinates)
  variables.width = painter.offsetWidth * 0.9;
  variables.height = painter.offsetHeight * 0.9;
  //sets the size of the canvas
  canvas.width = variables.width;
  canvas.height = variables.height;
  //if snapshot is provided, we set the canvas to this image
  if (snapshot !== undefined) {
    var img = new Image();
    img.addEventListener('load', function setCanvasToImage() {
      context.drawImage(img,0,0,variables.width,variables.height);
    });
    img.src = snapshot;
  }
}

/**
 * Sends a stroke command for a line tool with normalized variables to the server.
 * @param  {number} i The index of the click we want to send.
 */
function sendStroke(i) {
  var stroke = {};  //object for storing the command.

  //tells the server that this is a line
  stroke.type = 'line';
  //to and from values are normalized to floats, in order for other clients to be able to use meaningfully
  if (i > 0) {  //if it is not the first click, we can draw a line
    stroke.fromX = clicks.x[i-1] / variables.width;
    stroke.fromY = clicks.y[i-1] / variables.height;
  } else {  //else we have to simulate a first click
    stroke.fromX = (clicks.x[i]-1) / variables.width;
    stroke.fromY = clicks.y[i] / variables.height;
  }
  //to variables can always be calculated the same
  stroke.toX = clicks.x[i] / variables.width;
  stroke.toY = clicks.y[i] / variables.height;

  //the command also contains information about the line style (color and width)
  stroke.strokeStyle = context.strokeStyle;
  stroke.lineWidth = context.lineWidth;

  com.send(JSON.stringify(stroke)); //sends the command to the server
}

/**
 * Sends a chat message to the server.
 */
function sendMessage() {
  var box = document.getElementById('message_box');
  var content = box.value; box.value = '';
  var message = {};

  message.type = 'chatmessage';
  message.message = content;

  com.send(JSON.stringify(message));
}

/**
 * This method handles incoming commands from the server.
 * @param  {event} event The message event from the Websocket.
 */
function receivedCommand(event) {
  var command = JSON.parse(event.data);  //gets the command from the data.

  if (!command.type) {
    console.error('Command malformed, no type: ', event.data);
  } else {
    //calls the right function according to the command type
    switch (command.type) {
      case 'line':
        makeStroke(command);
      break;

      case 'background':
        setBackground(command);
      break;

      case 'deleteuser':
        deleteUser(command.name);
      break;

      case 'adduser':
        addUser(command.name);
      break;

      case 'userlist':
        setUserList(command.users);
      break;

      case 'chatmessage':
        addChatMessage(command.date, command.name, command.message)
      break;

      case 'chathistory':
        setChatHistory(command.history);
      break;

      default:
        console.error('Received unknown command type: ', command.type);
    }
  }
}

/**
 * Draws a stroke on the canvas.
 * @param  {object} stroke The command object describing the stroke.
 */
function makeStroke(stroke) {
  //sets the style of the line
  context.strokeStyle = stroke.strokeStyle;
  context.lineWidth = stroke.lineWidth;

  context.beginPath();
  context.moveTo(stroke.fromX * variables.width, stroke.fromY * variables.height);  //set the pointer to the from point, according to our canvas size
  context.lineTo(stroke.toX * variables.width, stroke.toY * variables.height);  //draw a line to the to point, according to our canvas size
  context.closePath();

  context.stroke(); //paints the path
}

/**
 * Sets the background of the canvas.
 * @param {object} back The command object describing the background.
 */
function setBackground(back) {
  context.fillStyle = back.fillStyle;
  context.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
}

/**
 * Adds a new user to the highscore list.
 * @param {string} name The name of the new user.
 */
function addUser(name) {
  var userBar = document.getElementById('highscore'); //gets the div containing all users
  var userDiv = document.createElement('div');

  userDiv.className = 'user'; //for styling
  userDiv.id = name;  //for finding the element when the user is deleted
  userDiv.appendChild(document.createTextNode(name));

  userBar.appendChild(userDiv);
}

/**
 * Deletes a disconnected user from the highscore list.
 * @param  {string} name The name of the disconnected user.
 */
function deleteUser(name) {
  var userBar = document.getElementById('highscore');
  userBar.removeChild(document.getElementById(name)); //every div has the name of the user as id
}

/**
 * Sets the userlist upon connection to client.
 * @param {array} users The array containing the names of all users.
 */
function setUserList(users) {
  var userBar = document.getElementById('highscore');

  if (userBar.firstChild) {
    console.error('Client got user list but already has users.'); //this command should only be sent to newly connected clients
  } else {
    users.forEach(addUser);
  }
}

/**
 * Adds a chat message to the chat window.
 * @param {string} date    A timestamp of when the message was received by the server, in the format Hours:Minutes:Seconds.
 * @param {string} name    The name of the user who sent the message.
 * @param {string} message The content of the message.
 */
function addChatMessage(date, name, message) {
  var history = document.getElementById('history'); //gets the chat area

  //creates a div for the date part and sets the content
  var dateDiv = document.createElement('div');
  dateDiv.className = 'messagedate';
  dateDiv.appendChild(document.createTextNode(date + ' '));

  //creates a div for the name part and sets the content
  var nameDiv = document.createElement('div');
  nameDiv.className = 'messagename';
  nameDiv.appendChild(document.createTextNode(name + ': '));

  //creates a div for the content part and sets the content
  var contentDiv = document.createElement('div');
  contentDiv.className = 'messagecontent';
  contentDiv.appendChild(document.createTextNode(message));

  //creates a div for the header part and sets the content
  var headerDiv = document.createElement('div');
  headerDiv.className = 'messageheader';
  headerDiv.appendChild(dateDiv); headerDiv.appendChild(nameDiv);

  //creates a div for the whole message and sets the content
  var msgDiv = document.createElement('div');
  msgDiv.className = 'chatmessage';
  msgDiv.appendChild(headerDiv); msgDiv.appendChild(contentDiv);

  history.appendChild(msgDiv);  //appends the message to the chat window
}

/**
 * Sets the content of the chat window for newly connected clients by adding all messages from the history array.
 * @param {array} history Contains all messages in the chat up to now.
 */
function setChatHistory(history) {
  history.forEach(function addOneMessageFromHistoryToHistory(message) {
    addChatMessage(message.date, message.name, message.message)
  })
}

/**
 * Various functions that have no other place go here.
 */

/**
 * Handles resize events, waiting a certain amount of time and then resizing canvas and loading saved state.
 */
(function() {
  window.addEventListener("resize", resizeThrottler);

  var setResize = true; //controls need of throttling
  function resizeThrottler() {
    // ignore resize events as long as an actualResizeHandler execution is in the queue
    if (setResize) {
      setResize = false;  //ignores future resize events
      resizeTimeout = setTimeout(function(snapshot) {
        setResize = true; //can accept resize requests again
        resizeCanvas(snapshot); //resizes the canvas and gives snapshot of content
      }(canvas.toDataURL('img/png',1)), 150);
    }
  }
}());

function handleEnter() {
  if (event.keyCode === 13) { //Enter key
    sendMessage();
  }
}
