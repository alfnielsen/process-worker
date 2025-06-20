import { ProcessWorker } from '../../../../src/ProcessWorker';

const w = await ProcessWorker.start("__logger-worker");

console.log("[logger-worker] Logger worker started");
w.post("ready", { type: "ready", workerName: "__logger-worker" });
// Listen for file changes stream (provided by the file-watcher worker)
w.on("file-change", (data) => {
  console.log(`[logger-worker] File change detected from stream: ${data.eventType} on ${data.filename}`);
});

