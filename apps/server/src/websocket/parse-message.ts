import { clientMessageSchema, MAX_CLIENT_MESSAGE_BYTES, type ClientMessage } from "@life-simulator/shared";

export type ParsedClientMessage =
  | { ok: true; message: ClientMessage }
  | { ok: false; requestId: string; code: "invalid_message"; message: string };

export function parseClientMessage(text: string): ParsedClientMessage {
  if (Buffer.byteLength(text) > MAX_CLIENT_MESSAGE_BYTES) {
    return {
      ok: false,
      requestId: "",
      code: "invalid_message",
      message: "The message is too large.",
    };
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return {
      ok: false,
      requestId: "",
      code: "invalid_message",
      message: "The message is not valid JSON.",
    };
  }

  const requestId = readRequestId(value);
  const parsed = clientMessageSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      requestId,
      code: "invalid_message",
      message: "The message is not a supported command.",
    };
  }

  return { ok: true, message: parsed.data };
}

function readRequestId(value: unknown): string {
  if (!value || typeof value !== "object" || !("requestId" in value)) {
    return "";
  }
  const requestId = value.requestId;
  if (typeof requestId !== "string" || requestId.length > 80) {
    return "";
  }
  return requestId;
}
