const relayUrl = process.env.CLOUDFLARE_RELAY_URL;
const agentKey = process.env.CLOUDFLARE_RELAY_AGENT_KEY;
const upstreamUrl = process.env.LOCAL_AI_UPSTREAM_URL
  ?? process.env.OLLAMA_URL
  ?? "http://127.0.0.1:8081";

if (!relayUrl) throw new Error("CLOUDFLARE_RELAY_URL is required");
if (!agentKey) throw new Error("CLOUDFLARE_RELAY_AGENT_KEY is required");

let reconnectDelay = 1_000;

function connect() {
  const socketUrl = relayUrl
    .replace(/^http:/, "ws:")
    .replace(/^https:/, "wss:")
    .replace(/\/$/, "") + "/agent/connect";
  const socket = new WebSocket(socketUrl);
  let heartbeat;

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ token: agentKey, type: "auth" }));
  });

  socket.addEventListener("message", (event) => {
    void handleMessage(socket, String(event.data));
  });

  socket.addEventListener("close", () => {
    clearInterval(heartbeat);
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
  });

  socket.addEventListener("error", () => socket.close());

  async function handleMessage(activeSocket, rawMessage) {
    let message;
    try {
      message = JSON.parse(rawMessage);
    } catch {
      return;
    }

    if (message.type === "auth_ok") {
      reconnectDelay = 1_000;
      console.log("SmartStudy local AI is connected to the Cloudflare relay.");
      heartbeat = setInterval(() => {
        if (activeSocket.readyState === WebSocket.OPEN) {
          activeSocket.send(JSON.stringify({ type: "ping" }));
        }
      }, 20_000);
      return;
    }
    if (message.type !== "request" || typeof message.id !== "string") return;

    try {
      const upstream = await fetch(`${upstreamUrl}${message.path}`, {
        body: message.body,
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      activeSocket.send(JSON.stringify({
        body: await upstream.text(),
        contentType: upstream.headers.get("content-type") ?? "application/json",
        id: message.id,
        status: upstream.status,
        type: "response",
      }));
    } catch {
      activeSocket.send(JSON.stringify({
        body: JSON.stringify({ error: "local_ai_unavailable" }),
        contentType: "application/json",
        id: message.id,
        status: 502,
        type: "response",
      }));
    }
  }
}

connect();
