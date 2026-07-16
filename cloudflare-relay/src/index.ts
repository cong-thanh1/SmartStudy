import { DurableObject } from "cloudflare:workers";

import { isAuthorized, parseAgentResponse } from "./protocol";

interface Env {
  readonly AI_RELAY: DurableObjectNamespace<AiRelay>;
  readonly RELAY_AGENT_KEY: string;
  readonly RELAY_API_KEY: string;
}

interface AgentAttachment {
  readonly authenticated: boolean;
}

interface RelayResult {
  readonly body: string;
  readonly contentType: string;
  readonly status: number;
}

interface PendingRequest {
  readonly reject: (reason: Error) => void;
  readonly resolve: (result: RelayResult) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MILLISECONDS = 150_000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const relay = env.AI_RELAY.get(env.AI_RELAY.idFromName("primary"));

    if (request.method === "GET" && url.pathname === "/agent/connect") {
      return relay.fetch(request);
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return relay.fetch(new Request("https://relay.internal/status"));
    }

    if (request.method !== "POST" || url.pathname !== "/v1/chat/completions") {
      return json({ error: "not_found" }, 404);
    }
    if (!isAuthorized(request.headers.get("x-api-key"), env.RELAY_API_KEY)) {
      return json({ error: "unauthorized" }, 401);
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_REQUEST_BYTES) {
      return json({ error: "request_too_large" }, 413);
    }
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) {
      return json({ error: "request_too_large" }, 413);
    }

    return relay.fetch(new Request("https://relay.internal/relay", {
      body,
      method: "POST",
    }));
  },
} satisfies ExportedHandler<Env>;

export class AiRelay extends DurableObject<Env> {
  private readonly pending = new Map<string, PendingRequest>();

  constructor(
    state: DurableObjectState,
    env: Env,
  ) {
    super(state, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/agent/connect") {
      return this.connectAgent(request);
    }
    if (request.method === "GET" && url.pathname === "/status") {
      return json({
        agentConnected: this.findAgent() !== null,
        service: "smartstudy-ai-relay",
        status: "ok",
      });
    }
    if (request.method === "POST" && url.pathname === "/relay") {
      return this.relay(await request.text());
    }
    return json({ error: "not_found" }, 404);
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      socket.close(1003, "invalid_json");
      return;
    }

    const attachment = socket.deserializeAttachment() as AgentAttachment | null;
    if (!attachment?.authenticated) {
      if (
        !isRecord(value) ||
        value.type !== "auth" ||
        typeof value.token !== "string" ||
        !isAuthorized(value.token, this.env.RELAY_AGENT_KEY)
      ) {
        socket.close(1008, "unauthorized");
        return;
      }
      for (const existing of this.ctx.getWebSockets("agent")) {
        if (existing !== socket) existing.close(1012, "replaced");
      }
      socket.serializeAttachment({ authenticated: true } satisfies AgentAttachment);
      socket.send(JSON.stringify({ type: "auth_ok" }));
      return;
    }

    if (isRecord(value) && value.type === "ping") {
      socket.send(JSON.stringify({ type: "pong" }));
      return;
    }

    const response = parseAgentResponse(value);
    if (!response) return;
    const pending = this.pending.get(response.id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(response.id);
    pending.resolve({
      body: response.body,
      contentType: response.contentType,
      status: response.status,
    });
  }

  async webSocketClose(): Promise<void> {
    if (this.findAgent() === null) this.rejectPending("AI agent disconnected");
  }

  async webSocketError(): Promise<void> {
    if (this.findAgent() === null) this.rejectPending("AI agent connection failed");
  }

  private connectAgent(request: Request): Response {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "websocket_required" }, 426);
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.serializeAttachment({ authenticated: false } satisfies AgentAttachment);
    this.ctx.acceptWebSocket(server, ["agent"]);
    return new Response(null, { status: 101, webSocket: client });
  }

  private findAgent(): WebSocket | null {
    return this.ctx.getWebSockets("agent").find((socket) => {
      const attachment = socket.deserializeAttachment() as AgentAttachment | null;
      return attachment?.authenticated === true;
    }) ?? null;
  }

  private async relay(body: string): Promise<Response> {
    const agent = this.findAgent();
    if (!agent) return json({ error: "AI_OFFLINE" }, 503);

    const id = crypto.randomUUID();
    const result = new Promise<RelayResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("AI relay request timed out"));
      }, REQUEST_TIMEOUT_MILLISECONDS);
      this.pending.set(id, { reject, resolve, timeout });
    });

    try {
      agent.send(JSON.stringify({
        body,
        id,
        path: "/v1/chat/completions",
        type: "request",
      }));
      const response = await result;
      return new Response(response.body, {
        headers: { "content-type": response.contentType },
        status: response.status,
      });
    } catch {
      return json({ error: "AI_RELAY_TIMEOUT" }, 504);
    }
  }

  private rejectPending(message: string): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(message));
      this.pending.delete(id);
    }
  }
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
