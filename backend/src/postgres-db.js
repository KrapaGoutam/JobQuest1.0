import { MessageChannel, Worker } from "node:worker_threads";

export function openPostgresDatabase(url) {
  const buffer = new SharedArrayBuffer(64 * 1024 * 1024);
  const header = new Int32Array(buffer, 0, 2);
  const output = new Uint8Array(buffer, 8);
  const { port1, port2 } = new MessageChannel();
  const worker = new Worker(new URL("./postgres-worker.js", import.meta.url), {
    workerData: { url, buffer, port: port2 },
    transferList: [port2],
  });
  const decoder = new TextDecoder();

  function rpc(message) {
    Atomics.store(header, 0, 0);
    Atomics.store(header, 1, 0);
    port1.postMessage(message);
    const wait = Atomics.wait(header, 0, 0, 30_000);
    if (wait === "timed-out") throw new Error("PostgreSQL operation timed out");
    const value = JSON.parse(decoder.decode(output.subarray(0, Atomics.load(header, 1))));
    if (value.error) throw new Error(value.error);
    return value;
  }

  return {
    dialect: "postgres",
    prepare(sql) {
      return {
        all: (...params) => rpc({ op: "query", sql, params }).rows,
        get: (...params) => rpc({ op: "query", sql, params }).rows[0],
        run: (...params) => rpc({ op: "query", sql, params }),
      };
    },
    exec: (sql) => rpc({ op: "query", sql }),
    close() {
      try { rpc({ op: "close" }); } finally { worker.terminate(); port1.close(); }
    },
  };
}
