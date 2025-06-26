import Redis from "ioredis";

const redis = new Redis();
const sub = new Redis();
const pub = new Redis();
// Usage 1: As message hub
const processMessage = (message: [string, any]) => {
  console.log("Id: %s. Data: %O", message[0], message[1]);
};

// define action 
const actId = crypto.randomUUID();
const actName = "my-action";
const act = {
  id: actId,
  name: actName,
  stream: `action-event:${actName}:${actId}`,
  key: `action:${actName}:${actId}`,
  payload: {
    title: "Redis Pub/Sub with Node.js",
    content: "This is a test message for Redis Pub/Sub with Node.js",
  },
};

function listenForAction(/** act input here... */) {
  async function xread(lastId = "$") {
    const results = await sub.xread("BLOCK", 0, "STREAMS", act.stream, lastId);
    if (results !== null) {
      const res = results[0];
      console.log("Received results:", res);
      if (res && res.length === 2) {
        const [key, messages] = res; // `key` equals to "act.stream"
        console.log("key:", key);
        for (const [id, [name, data]] of messages) {
          console.log("id:", id);
          console.log("name:", name);
          console.log("data:", data);
          // const parsedData = JSON.parse(data);
          // console.log("Parsed data:", parsedData);
        }
        const last = messages[messages.length - 1];
        lastId = last?.[0] ?? "$"; // The last id of the results, e.g. "1647321710097-0"
      }
    }
    // Pass the last id of the results to the next round.
    await xread(lastId);
  }
  // Start listening for messages
  xread();
}
listenForAction();

// Publish messages every second
setInterval(() => {
  // `redis` is in the block mode due to `redis.xread('BLOCK', ....)`,
  // so we use another connection to publish messages.
  const randomData = {
    id: crypto.randomUUID(),
    name: "John Doe",
    age: Math.floor(Math.random() * 100) + 1,
  };
  const data =  JSON.stringify(randomData);
  pub.xadd(act.stream, "*", "data", data);
}, 1000);
