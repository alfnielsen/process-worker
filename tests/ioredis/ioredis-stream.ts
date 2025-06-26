import Redis from "ioredis";

const redis = new Redis();
const sub = new Redis();
const pub = new Redis();

const streamName = "user-stream";

// Usage 1: As message hub
const processMessage = (message: [string, any]) => {
  console.log("Id: %s. Data: %O", message[0], message[1]);
};

async function listenForMessage(lastId = "$") {
  // `results` is an array, each element of which corresponds to a key.
  // Because we only listen to one key (mystream) here, `results` only contains
  // a single element. See more: https://redis.io/commands/xread#return-value
  const results = await sub.xread("BLOCK", 0, "STREAMS", streamName, lastId);
  if(results === null) {
    console.log("No messages received, exiting...");
    return;
  }
  const res = results[0];
  if(!res || res.length < 2) {
    console.log("No messages received, exiting...");
    return;
  }
  const [key, messages] = res; // `key` equals to "user-stream"
  messages.forEach(processMessage);
  const last = messages[messages.length - 1];
  lastId = last?.[0] ?? "$"; // The last id of the results, e.g. "1647321710097-0"
  // Pass the last id of the results to the next round.
  await listenForMessage(lastId);
}
// Start listening for messages
listenForMessage();

// Publish messages every second
setInterval(() => {
  // `redis` is in the block mode due to `redis.xread('BLOCK', ....)`,
  // so we use another connection to publish messages.
  pub.xadd(streamName, "*", "name", "John", "age", "20");
}, 1000);

// Usage 2: As a list
const listStreamName = "list-stream";
async function main() {
  redis
    .pipeline()
    .xadd(listStreamName, "*", "id", "item1")
    .xadd(listStreamName, "*", "id", "item2")
    .xadd(listStreamName, "*", "id", "item3")
    .exec();

  const items = await redis.xrange(listStreamName, "-", "+", "COUNT", 2);
  console.log("Items in the list stream:");
  console.log(items);
  const items2 = await redis.xrange(listStreamName, "-", "+", "COUNT", 2);
  console.log(items2);
  // [
  //   [ '1647321710097-0', [ 'id', 'item1' ] ],
  //   [ '1647321710098-0', [ 'id', 'item2' ] ]
  // ]
}

main();