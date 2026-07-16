export interface AgentResponseMessage {
  readonly body: string;
  readonly contentType: string;
  readonly id: string;
  readonly status: number;
  readonly type: "response";
}

export function isAuthorized(actual: string | null, expected: string): boolean {
  if (actual === null || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index++) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export function parseAgentResponse(value: unknown): AgentResponseMessage | null {
  if (!isRecord(value) || value.type !== "response") return null;
  if (
    typeof value.id !== "string" ||
    typeof value.body !== "string" ||
    typeof value.contentType !== "string" ||
    typeof value.status !== "number" ||
    !Number.isInteger(value.status) ||
    value.status < 100 ||
    value.status > 599
  ) {
    return null;
  }
  return {
    body: value.body,
    contentType: value.contentType,
    id: value.id,
    status: value.status,
    type: "response",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
