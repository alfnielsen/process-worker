<script setup>
import { ref } from 'vue'
import  { ClientConnector}  from "redis-process-worker/client"

const username = ref('user-' + Math.floor(Math.random() * 1000))
const message = ref('some message')
const messages = ref([])

const ws = new ClientConnector('ws://localhost:3080')

ws.on("chat", (data) => {
  console.log("Received message:", data)
  messages.value.unshift(data)
})

function sendMessage() {
  if (!username.value || !message.value) return
  console.log("Sending message:", { user: username.value, text: message.value })
  ws.post("chat", {
    user: username.value,
    text: message.value
  })
  // Add random new message to local state
  message.value = "abcdefghijklmnopqrstuvwxyz".split('').sort(() => Math.random() - 0.5).join('').substring(0, 10)
}
</script>

<template>
  <div class="chat-container">
    <h2>Chat Client</h2>
    <div class="chat-messages">
      <div v-for="(msg, idx) in messages" :key="idx" class="chat-message-wrapper" :class="{ self: msg.user === username }">
        <div class="chat-bubble" :class="{ self: msg.user === username, other: msg.user !== username }">
          <span class="chat-user" v-if="msg.user !== username">{{ msg.user }}:</span>
          <span class="chat-user self-user" v-if="msg.user === username">{{ msg.user }}:</span>
          <span class="chat-text">{{ msg.text }}</span>
        </div>
      </div>
    </div>
    <div class="chat-inputs">
      <input v-model="username" placeholder="Username" class="chat-username" />
      <input v-model="message" placeholder="Type a message..." class="chat-message-input" @keyup.enter="sendMessage" />
      <button @click="sendMessage">Send</button>
    </div>
  </div>
</template>

<style scoped>
.chat-container {
  color: #333;
  max-width: 400px;
  margin: 2rem auto;
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  background: #ddd;
}
.chat-messages {
  min-height: 120px;
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 1rem;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 0.5rem;
}
.chat-message-wrapper {
  display: flex;
  margin-bottom: 0.5rem;
}
.chat-message-wrapper.self {
  justify-content: flex-start;
}
.chat-message-wrapper:not(.self) {
  justify-content: flex-end;
}
.chat-bubble {
  max-width: 70%;
  padding: 0.5rem 0.75rem;
  border-radius: 18px;
  background: #e0e0e0;
  color: #222;
  position: relative;
  word-break: break-word;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.chat-bubble.self {
  background: #b3e5fc;
  color: #222;
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 18px;
  border-top-right-radius: 18px;
  border-top-left-radius: 18px;
  align-self: flex-start;
}
.chat-bubble.other {
  background: #c8e6c9;
  color: #222;
  border-bottom-right-radius: 4px;
  border-bottom-left-radius: 18px;
  border-top-left-radius: 18px;
  border-top-right-radius: 18px;
  align-self: flex-end;
}
.chat-user {
  font-size: 0.85em;
  font-weight: bold;
  margin-right: 0.5em;
}
.self-user {
  margin-left: 0.5em;
}
.chat-text {
  font-size: 1em;
}
.chat-inputs {
  display: flex;
  gap: 0.5rem;
}
.chat-username {
  width: 90px;
}
.chat-message-input {
  flex: 1;
}
</style>
