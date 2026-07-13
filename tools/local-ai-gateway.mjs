import { createServer } from "node:http";

const port = Number(process.env.LOCAL_AI_GATEWAY_PORT ?? "8080");
const apiKey = process.env.LOCAL_AI_GATEWAY_KEY;
const upstream = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";

if (!apiKey) throw new Error("LOCAL_AI_GATEWAY_KEY is required");

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
    response.writeHead(404).end();
    return;
  }
  if (request.headers["x-api-key"] !== apiKey) {
    response.writeHead(401).end(JSON.stringify({ error: "unauthorized" }));
    return;
  }
  try {
    const upstreamResponse = await fetch(`${upstream}/v1/chat/completions`, {
      body: await readBody(request),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    response.writeHead(upstreamResponse.status, {
      "content-type": upstreamResponse.headers.get("content-type") ?? "application/json",
    });
    response.end(Buffer.from(await upstreamResponse.arrayBuffer()));
  } catch {
    response.writeHead(502).end(JSON.stringify({ error: "ollama_unavailable" }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`SmartStudy local AI gateway listening on 127.0.0.1:${port}`);
});

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}
