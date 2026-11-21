import { createConnection } from "node:net";
import { WebSocketServer } from "ws";

const port = Number(process.env.ONEHOPE_PG_WS_PORT ?? 4444);
const pgPort = Number(process.env.PGPORT ?? 5432);
const sockets = new WebSocketServer({ port });

sockets.on("connection", (browser) => {
  const database = createConnection({ host: "127.0.0.1", port: pgPort });
  browser.on("message", (data) => {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (!database.destroyed) database.write(bytes);
  });
  database.on("data", (chunk) => {
    if (browser.readyState === browser.OPEN) browser.send(chunk);
  });
  const stop = () => {
    if (!database.destroyed) database.destroy();
    if (browser.readyState === browser.OPEN) browser.close();
  };
  browser.on("close", stop);
  browser.on("error", stop);
  database.on("error", stop);
  database.on("close", () => {
    if (browser.readyState === browser.OPEN) browser.close();
  });
});

sockets.on("listening", () => {
  process.stdout.write(`Postgres websocket proxy on ${port}\n`);
});
