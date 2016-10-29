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
function setLine(size) {
  var settings = predefined[event.srcElement.id]; //gets settings depending on which tool was selected
  if (settings === undefined) {
    console.error('User tried to access undefined line tool ' + event.srcElement.id + '.');
  }
  context.strokeStyle = settings.strokeStyle;
  context.lineWidth = settings.lineWidth;

  addLineOptions(settings.lineWidth); //adds the options for our tool in the tooloptions box
}

/**
 * Ensures buttons for setting background color are present as needed.
 */
function setBackground() {
  var box = document.getElementById('tooloptions');

  //checks for linesize option and removes it if present
  if (document.getElementById('linesize')) {
    removeSizeChooser(box);
  }
  //checks for state of color chooser
  if (!document.getElementById('white')) {  //if not present add it
    addColorChooser(box, 'sendBackground()');
  } else if (document.getElementById('white').getAttribute('onclick') === 'setColor()') { //if present but with wrong logic change logic
    document.querySelectorAll('button.color').forEach(function changeColorButtonHandlerToBackground(button) {
      button.setAttribute('onclick', 'sendBackground()');
    });
  }

  box.removeAttribute('hidden');
}

/**
 * Clears the background. (i.e. resets to white)
 */
function clearBackground() {
  sendBackground('white');  //sets background to white
  //removes tool options for other tools if present
  var box = document.getElementById('tooloptions');
  if (document.getElementById('linesize')) {
    removeSizeChooser(box);
  }
  if (document.getElementById('white')) {
    removeColorChooser(box);
  }
  box.setAttribute('hidden');
}

/**
 * Sets the background to a color.
 */
function sendBackground(color) {
  var back = {};
  back.type = 'background';
  back.fillStyle = color ? color : event.srcElement.id;
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
  // TODO: remove -2 in production
  variables.width = painter.offsetWidth * 0.9 - 2;
  variables.height = painter.offsetHeight * 0.9 - 2;
  //sets the size of the canvas
  canvas.width = variables.width - 2;
  canvas.height = variables.height - 2;
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
 * Sends a name change request to the server.
 */
function changeName() {
  var box = document.getElementById('name_box');
  var content = box.value; box.value = '';
  var message = {};

  message.type = 'nameChangeRequest';
  message.name = content;

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
        colorBackground(command);
      break;

      case 'deleteuser':
        deleteUser(command.name);
      break;

      case 'adduser':
        addUser(command.name);
      break;

      case 'userNameChange':
        changeUserName(command.former, command.new);
      break;

      case 'nameAlreadyTaken':
        addErrorMessage('User name already taken');
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
function colorBackground(back) {
  context.fillStyle = back.fillStyle;
  context.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
}

/**
 * Adds a new user to the user_list list.
 * @param {string} name The name of the new user.
 */
function addUser(name) {
  var userBar = document.getElementById('user_list'); //gets the div containing all users
  var userDiv = document.createElement('div');

  userDiv.className = 'user'; //for styling
  userDiv.id = name;  //for finding the element when the user is deleted
  userDiv.appendChild(document.createTextNode(name));

  userBar.appendChild(userDiv);
}

/**
 * Deletes a disconnected user from the user_list list.
 * @param  {string} name The name of the disconnected user.
 */
function deleteUser(name) {
  var userBar = document.getElementById('user_list');
  userBar.removeChild(document.getElementById(name)); //every div has the name of the user as id
}

/**
 * Changes the user name of the respective user in our UI.
 * @param  {string} formerName The former name of the user.
 * @param  {string} newName    The new name of the user.
 */
function changeUserName(formerName, newName) {
  var user = document.getElementById(formerName);
  user.id = name;
  user.removeChild(user.firstChild);
  user.appendChild(document.createTextNode(newName));
}

/**
 * Adds an error message to the chat.
 * @param {string} text The message text of the error.
 */
function addErrorMessage(text) {
  addChatMessage("ERROR", "SYSTEM", text);
}

/**
 * Sets the userlist upon connection to client.
 * @param {array} users The array containing the names of all users.
 */
function setUserList(users) {
  var userBar = document.getElementById('user_list');

  if (userBar.querySelector('div.user')) {
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
 * Adds the tool options for line tools.
 * @param {number} size The line size for the specific tool
 */
function addLineOptions(size) {
  var box = document.getElementById('tooloptions');
  //checks for state of color chooser
  if (!document.getElementById('white')) {  //if not present load it
    addColorChooser(box, 'setColor()');
  } else if (document.getElementById('white').getAttribute('onclick') === 'sendBackground()') { //if wrong logic (background) change logic
    document.querySelectorAll('button.color').forEach(function changeColorButtonHandlerToBackground(button) {
      button.setAttribute('onclick', 'setColor()');
    });
  }
  //checks state of size chooser
  if (!document.getElementById('linesize')) { //if not present load it
    addSizeChooser(box, size);
  } else {  //if present adjust size according to our tool
    document.getElementById('linesize').value = size;
  }
  //show the box
  box.removeAttribute('hidden');
}

/**
 * Adds the buttons for choosing color to the tool-options box.
 * @param  {DomNode} box The tool-options box.
 */
function addColorChooser(box, click) {
  //the 16 web colors
  var colors = ['white', 'silver', 'gray', 'black', 'red', 'maroon', 'yellow', 'olive', 'lime', 'green', 'aqua', 'teal', 'blue', 'navy', 'fuchsia', 'purple'];

  //creates the heading
  var button = document.createElement('p');
  button.id = 'colorheading';
  button.appendChild(document.createTextNode('Choose color:'));
  box.appendChild(button);

  //creates the color buttons
  colors.forEach(function addColorButtonsToOptions(color) {
    button = document.createElement('button');

    button.className = 'color';
    button.id = color;
    button.style = 'background:' + color + ';';
    button.setAttribute('onclick', click);

    box.appendChild(button);
  });
}

/**
 * Removes color chooser from tool options.
 * @param  {DomNode} box The toolbox from whence color chooser shall be removed.
 */
function removeColorChooser(box) {
  box.removeChild(document.getElementById('colorheading'));
  document.querySelectorAll('button.color').forEach(function deleteColorButtonsFromOptions(button) {
    box.removeChild(button);
  });
}

/**
 * Sets the stroke style to the color name hidden inside the id of the pressed color button.
 */
function setColor() {
  context.strokeStyle = event.srcElement.id;
}

/**
 * Adds the size chooser to the tooloptions box.
 * @param {DomNode} box  The toolotions box to add to.
 * @param {number} size The line size of the respective tool.
 */
function addSizeChooser(box, size) {
  //creates the heading
  var el = document.createElement('p');
  el.id = 'sizeheading';
  el.appendChild(document.createTextNode('Choose size:'));
  box.appendChild(el);
  //creates the input for linesize
  el = document.createElement('input');
  el.id = 'linesize'
  el.type = 'text';
  el.value = size;
  el.setAttribute('oninput', 'setSize()');

  box.appendChild(el);
}

/**
 * Removes the size chooser from the tooloptions box.
 * @param  {DomNode} box The tooloptions box from whence to remove.
 */
function removeSizeChooser(box) {
  box.removeChild(document.getElementById('sizeheading'));
  box.removeChild(document.getElementById('linesize'));
}

/**
 * Sets the size of the brush.
 */
function setSize() {
  context.lineWidth = Number(event.srcElement.value);
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
