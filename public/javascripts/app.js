// Modutech Inc.
// GroupChat client application demo

import { createApp } from 'vue'

const asJson = obj => JSON.stringify(obj)

function Service(socket) {
  return {
    login(userId, passwd) {
      if (socket) {
        socket.send(asJson({
          cmd: 'login',
          userId
        }))
      }
    },
    logout(userId) {
      if (socket) {
        socket.send(asJson({
          cmd: 'logout',
          userId
        }))
      }
    },
    join(roomId) {
      if (socket) {
        socket.send(asJson({
          cmd: 'join',
          roomId
        }))
      }
    },
    leave(roomId) {
      if (socket) {
        socket.send(asJson({
          cmd: 'leave',
          roomId
        }))
      }
    },
    send(roomId, from, message) {
      if (socket) {
        socket.send(asJson({
          cmd: 'message',
          roomId,
          from,
          message
        }))
      }
    },
  }
}

function getQueryValue(key) {
  const params = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
  });
  return params[key]
}

createApp({
  data() {
    return {
      messages: [],
      userId: 'user1',
      socket: null,
      roomId: '',
      socketConnected: false,
      service: null,
      rooms: []
    }
  },
  mounted() {
    this.rooms = new Array(3).fill(0).map((v, i) => {
      return {
        roomId: 'room' + i,
        messages: [],
        text: '',
        isJoined: false,
      }
    })

    const socket = this.initSocket()
    this.service = Service(socket)

    this.userId = getQueryValue('user_id') || 'user-' + Math.floor(Math.random() * 100)


    window.addEventListener("keydown", event => {
      if (event.defaultPrevented) {
        return; // Should do nothing if the default action has been cancelled
      }

      let handled = false;

      if (event.key === 't') {
        handled = true;
        this.$refs['inputText'].focus()
        this.$refs['inputText'].select()
      }

      if (handled) {
        event.preventDefault();
      }
    })
  },
  methods: {
    login() {
      this.service.login(this.userId)
    },
    logout() {
      this.service.logout(this.userId)
    },
    join(roomId) {
      if (roomId) {
        this.service.join(roomId)
        return
      }
      this.service.join(this.roomId)
    },
    leave(roomId) {
      if (roomId) {
        this.service.leave(roomId)
        return
      }
      this.service.leave(this.roomId)
    },
    send(roomId, text) {
      if (roomId) {
        this.service.send(roomId, this.userId, text)
        return
      }
      this.service.send(this.roomId, this.userId, this.text)
    },
    reconnectSocket() {
      this.initSocket()
    },
    goToBottom(id) {
      console.log(id)
      const els = this.$refs[id]
      if (els) {
        const el = els[0] // I cannot understand why it returns array
        if (el) {
          el.scrollTop = el.scrollHeight + 50
        }
      }
    },

    updateState(roomId, isSuccess) {

      const room = this.rooms.find(room => room.roomId === roomId)
      if (room) {
        room.isJoined = isSuccess
      }
    },
    pushMessage(obj) {

      const room = this.rooms.find(room => room.roomId === obj.roomId)
      if (room) {
        room.messages.push(obj)
        this.goToBottom('msg_box_' + obj.roomId)
      } else {
        console.log('[x] unknown room:', obj.roomId)
      }
    },
    initSocket() {
      this.socket = new WebSocket("ws://localhost:3000");
      this.service = Service(this.socket)
      const { socket } = this
      socket.onopen = (e) => {
        this.socketConnected = true
        this.login()
      };

      socket.onmessage = (event) => {
        console.log(`[message] Data received from server: ${event.data}`);
        const obj = JSON.parse(event.data)
        this.pushMessage(obj)

        if (obj.cmd === 'login' && obj.success) {
          // rejoin existing rooms
          this.rooms.filter(room => room.isJoined)
            .forEach(room => this.join(room.roomId))
        }

        if (obj.cmd === 'join' && obj.success) {
          this.updateState(obj.roomId, true)
        }

        if (obj.cmd === 'leave' && obj.success) {
          this.updateState(obj.roomId, false)
        }
      };

      socket.onclose = (event) => {
        if (event.wasClean) {
          console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
        } else {
          // e.g. server process killed or network down
          // event.code is usually 1006 in this case
          console.log('[close] Connection died');
        }
        this.socketConnected = false

        setTimeout(() => {
          console.log('try to reconnect')
          this.initSocket()
        }, 1000)
      };

      socket.onerror = (error) => {
        console.log(`[error]`, error);
      };
      return socket
    }
  }
}).mount('#app')
