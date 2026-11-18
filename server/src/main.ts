import { createServer } from "node:http";

import { createApi } from "./api";
import { ChurchStore } from "./store";

const port = Number(process.env.PORT ?? "8787");
const store = ChurchStore.demo();
const handle = createApi({ store });

const server = createServer(async (incoming, outgoing) => {
  try {
    const host = incoming.headers.host ?? `127.0.0.1:${port}`;
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) {
      if (typeof value === "string") headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(", "));
    }
    const request = new Request(`http://${host}${incoming.url ?? "/"}`, {
      method: incoming.method,
      headers,
      body: incoming.method === "GET" || incoming.method === "HEAD" || body.length === 0 ? undefined : body,
    });
    const response = await handle(request);
    outgoing.statusCode = response.status;
    response.headers.forEach((value, key) => outgoing.setHeader(key, value));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.statusCode = 500;
    outgoing.end(JSON.stringify({ ok: false, error: "The server failed.", code: "error" }));
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`onehope api listening on ${port}\n`);
});
