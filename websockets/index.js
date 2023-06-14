
const ws = require('ws')
const { v4 } = require('uuid')

const amqp = require('../amqp')

const wsServer = new ws.Server({ noServer: true });
const clients = new Set();

const { log } = console

let callback = socket => (msg) => {
  console.log(" [x] %s: '%s' %s", msg.fields.routingKey, msg.content.toString(), socket.id);

  const mmm = JSON.parse(msg.content.toString())

  socket.send(asJson({
    roomId: msg.fields.routingKey,
    from: mmm.from,
    message: mmm.message
  }))
}

function wsConnected(socket) {
  socket.id = v4()
  clients.add(socket)
  socket.on('message', onMessageHandle(socket));
  socket.on('close', onCloseHandle(socket));
}

function Amqp(socket) {
  if (!socket.$amqp) {
    // socket.send('error:no amqp connection')
    socket.send(asJson({
      error: 'no AMQP connection'
    }))
    throw new Error("No AMQP connection")
  }
  return socket.$amqp
}

function asJson(obj) {
  return JSON.stringify(obj)
}

function onMessageHandle(socket) {
  return message => {
    const msg = message.toString('utf8')

    const obj = JSON.parse(msg)

    const cmd = obj.cmd

    if (cmd === 'login') {
      const callbackH = callback(socket)

      if (socket.loggedIn) {
        socket.send(asJson({
          cmd: 'login',
          success: false
        }))
        return
      }
      socket.userId = obj.userId
      socket.loggedIn = true

      amqp.init(callbackH).then(amp => {
        socket.$amqp = amp
        socket.send(asJson({
          cmd: 'login',
          success: true
        }))
      })

    } else if (cmd === 'logout') {
      if (socket.loggedIn) {
        Amqp(socket).disconnect()
          .then(() => {
            socket.loggedIn = false
            socket.send(asJson({
              cmd: 'logout',
              success: true
            }))
          })
          .catch(e => log(e.message))
      }
    }
    else if (cmd === 'join') {
      try {
        Amqp(socket).join(obj.roomId).then(() => {
          socket.send(asJson({
            cmd: 'join',
            roomId: obj.roomId,
            success: true
          }))
        })
      } catch (err) {
        log(err.message)
      }
    } else if (cmd === 'leave') {
      try {
        Amqp(socket).leave(obj.roomId).then(() => {
          // socket.send('leave:success')
          socket.send(asJson({
            cmd: 'leave',
            roomId: obj.roomId,
            success: true
          }))
        })
      } catch (err) {
        log(err.message)
      }
    }
    else if (cmd === 'message') {
      try {
        Amqp(socket).send(obj.roomId, asJson(
          {
            from: obj.from,
            message: obj.message
          }
        ))
      } catch (err) {
        log(err.message)
      }
    }
  }
}

function onCloseHandle(socket) {
  return () => {
    clients.delete(socket)
    log('[e] socket closed ', socket.userId)
  }
}

wsServer.on('connection', wsConnected);

module.exports = {
  init(server) {
    server.on('upgrade', (request, socket, head) => {
      wsServer.handleUpgrade(request, socket, head, socket => {
        wsServer.emit('connection', socket, request);
      });
    });
  }
}
