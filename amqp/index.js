const amqp = require('amqplib');

const EXCHANGE = 'direct_logs';

async function init(callback) {

  const connection = await amqp.connect('amqp://localhost');

  const channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE, 'direct', { durable: false });

  const queue = await channel.assertQueue('', { exclusive: true })

  channel.consume(queue.queue, callback, { noAck: true });

  async function leave(room) {
    return channel.unbindQueue(queue.queue, EXCHANGE, room);
  }

  async function join(room) {
    await channel.assertExchange(EXCHANGE, 'direct', { durable: false });
    channel.bindQueue(queue.queue, EXCHANGE, room);
  }

  function send(room, msg) {
    channel.publish(EXCHANGE, room, Buffer.from(msg))
  }

  function disconnect() {
    return connection.close(err => {
      console.log('[**] rabbitmq connection disconnected')
    })
  }

  return {
    leave, join, send, disconnect
  }
}

module.exports = {
  init
}
