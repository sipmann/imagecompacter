const { EventEmitter } = require('events');
const express = require('express');
const fileUpload = require('express-fileupload');

const imagemin = require('imagemin');
const imageminPngquant = require('imagemin-pngquant');

//create an eventEmitter so we can receive the answer
const eventEmitter = new EventEmitter();

let channel = null;
const QUEUE = 'imgqueue';

function init() {
  return require('amqplib').connect('amqp://localhost')
    .then(conn => conn.createChannel())
    .then(ch => {
      channel = ch;
      
      //this queue is a "Direct reply-to", read more at the docs
      ch.consume('amq.rabbitmq.reply-to', msg => eventEmitter.emit(msg.properties.correlationId, msg.content), {noAck: true});
    });
}

function randomid() {
  return new Date().getTime().toString() + Math.random().toString() + Math.random().toString();
}

//Instantiate the app and set the fileupload parser to manage files
const app = express();
app.use(fileUpload());

//Our index entry point
app.get('/', (req, res) => res.send('Hello From ImageCompacter service'));

//The path that will handle the image file and throw them to the queue
app.post('/upload', (req, res) => {

  //With express-fileupload we can grab the files like this
  let img = req.files.image; //"image" is the name of the input

  let id = randomid();

  //Event listener that will fire when the proper randomid is retrieved
  eventEmitter.once(id, msg => {
    res.write(msg, 'binary');
    res.end(null, 'binary');
  });

  channel.assertQueue(QUEUE)
    .then(() => channel.sendToQueue(QUEUE, img.data, { 
      correlationId: id,
      replyTo: 'amq.rabbitmq.reply-to'}));

});

//Finally start the app with the given port number
//now we initialize the rabbitmq connection before start the server
init()
  .then(() => app.listen(4000, () => console.log('Example app listening on port 4000!')))
  .catch(err=>console.error(err));