import { join } from "path"
import { config, logger } from "./app-server-config"

const log = logger.titleLogFunc("chat-server", "cyan")

log(`Chat client worker started`)

const redisHubSocketClientPath = join(import.meta.dirname, "../../dist/client.js")
let redisHubSocketClientContent = await Bun.file(redisHubSocketClientPath).text()
if (!redisHubSocketClientContent) {
  throw new Error(`Could not read RedisHubSocketClient from ${redisHubSocketClientPath}`)
}
// remove "export" from the content
redisHubSocketClientContent = redisHubSocketClientContent.replace(/export\s*{\s*RedisHubSocketClient\s*}/, "")
  

// Simple Bun web server serving a chat HTML page
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Chat Example</title>
  <style>
    body { font-family: sans-serif; margin: 2em; }
    #messages { border: 1px solid #ccc; height: 200px; overflow-y: auto; margin-bottom: 1em; padding: 0.5em; }
    #input { width: 250px; }
    #send { width: 150px; }
    #user { font-weight: bold; margin-bottom: 1em; display: inline-block; background: #f0f0f0; padding: 0.5em;  }
  </style>
</head>
<body>
  <h1>Chat Example</h1>
  <div id="messages"></div>
  <span id="user"></span>
  <input id="input" type="text" placeholder="Type a message..." />
  <button id="send">Send</button>
  <script>
    // WebSocket url
    const WS_URL = 'ws://localhost:${config.serverPort}'
    // Client hub class
    ${redisHubSocketClientContent}
    // Connect to the RedisHubSocket server
    
    RedisHubSocketClient.connect(WS_URL)
    .then((client) => {
      const user = "a-user-" + Math.floor(Math.random() * 1000);
      document.getElementById('user').textContent = 'User: ' + user;
      // Listen for messages on the "chat" stream
      client.listen("chat", msg => {
        const div = document.createElement('div');
        div.textContent = msg.data.user + ': ' + msg.data.text;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
      })
      // Html elm
      const messages = document.getElementById('messages');
      const input = document.getElementById('input');
      const send = document.getElementById('send');
      send.onclick = () => {
        if (!input.value) return;        
        client
          .publish("chat", "msg", { user, text: input.value })
          .then(() => {
            input.value = '';
          })        
      };
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') send.onclick();
      });
    })
  </script>
</body>
</html>`

const server = Bun.serve({
  port: config.clientPort,
  fetch(req, server) {
    return new Response(html, { headers: { "Content-Type": "text/html" } })
  },
})

log(`Server listening on http://localhost:${config.clientPort}`, "info", { prefix: config.appPrefix })
