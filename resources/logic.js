var canvas;
var context;
document.addEventListener('DOMContentLoaded', function(e) {
  canvas = document.getElementById('picture');
  context = canvas.getContext('2d');
  resizeCanvas();
  setCrayon();
});
var clicks = {x: [], y: [], drag: []};
var paint = false;

function startPainting() {
  paint = true;
  addClick(event.pageX - context.canvas.offsetLeft, event.pageY - context.canvas.offsetTop);
}

function doPaint() {
  if (paint) {
    addClick(event.pageX - context.canvas.offsetLeft, event.pageY - context.canvas.offsetTop, true);
  }
}

function stopPainting() {
  paint = false;
}

function addClick(x, y, dragging) {
  clicks.x.push(x);
  clicks.y.push(y);
  clicks.drag.push(dragging);

  makeStroke(clicks.x.length-1);
}

//tool functions
function setCrayon() {
  context.strokeStyle = "black";
  context.lineJoin = "round";
  context.lineWidth = 5;
}

function setPencil() {
  context.strokeStyle = "black";
  context.lineJoin = "round";
  context.lineWidth = 1;
}

function setBackground() {
  // var painter = document.getElementById('painter');
  context.fillStyle = "black";
  context.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
}

function setErase() {
  context.strokeStyle = "white";
  context.lineJoin = "square";
  context.lineWidth = 10;
}

function clearCanvas() {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
}

function resizeCanvas() {
  var painter = document.getElementById('painter');
  var canvas = document.getElementById('picture');
  canvas.width = painter.offsetWidth * 0.9;
  canvas.height = painter.offsetHeight * 0.8;
}

function makeStroke(i) {
  context.beginPath();
  if(clicks.drag[i]){
    context.moveTo(clicks.x[i-1], clicks.y[i-1]);
   }else{
    context.moveTo(clicks.x[i]-1, clicks.y[i]);
   }
   context.lineTo(clicks.x[i], clicks.y[i]);
   context.closePath();
   context.stroke();
}
