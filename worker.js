const imagemin = require('imagemin');
const imageminPngquant = require('imagemin-pngquant');

let channel = null;
const QUEUE = 'imgqueue';

require('amqplib').connect('amqp://localhost')
  .then(conn =>conn.createChannel())
  .then(ch => {
    ch.assertQueue(QUEUE)
      .then(() => {
        ch.consume(QUEUE, msg => {
          imagemin.buffer(msg.content, {
            plugins: [imageminPngquant()]
          })
          .then(out => {
            ch.sendToQueue(msg.properties.replyTo, out, {
              correlationId: msg.properties.correlationId
            });

            ch.ack(msg);
          });
        });
      });
  });
