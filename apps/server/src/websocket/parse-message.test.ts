import { describe, expect, it } from "vitest";
import { MAX_CLIENT_MESSAGE_BYTES } from "@life-simulator/shared";
import { parseClientMessage } from "./parse-message.js";

describe("parseClientMessage", () => {
  it("rejects malformed JSON without throwing", () => {
    const parsed = parseClientMessage("{");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.code).toBe("invalid_message");
    }
  });

  it("rejects an oversized payload", () => {
    const parsed = parseClientMessage(`{"pad":"${"x".repeat(MAX_CLIENT_MESSAGE_BYTES)}"}`);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.message).toBe("The message is too large.");
    }
  });
});
