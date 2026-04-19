// src/lib/__tests__/renderAdminChatContent.test.ts
import assert from "node:assert/strict";
import { renderAdminChatContent } from "../renderAdminChatContent";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n    ${(e as Error).message}`); }
}

console.log("renderAdminChatContent");

test("plain text → single text segment", () => {
  const out = renderAdminChatContent("just a plain message", { deals: {} });
  assert.deepEqual(out, [{ type: "text", value: "just a plain message" }]);
});

test("mention → mention segment with email + name", () => {
  const out = renderAdminChatContent(
    "hey @[John Orlando](john@x.com) look",
    { deals: {} }
  );
  assert.deepEqual(out, [
    { type: "text", value: "hey " },
    { type: "mention", email: "john@x.com", name: "John Orlando" },
    { type: "text", value: " look" },
  ]);
});

test("deal chip → deal segment with resolved name", () => {
  const out = renderAdminChatContent(
    "see [deal:abc123] today",
    { deals: { abc123: "Acme Corp" } }
  );
  assert.deepEqual(out, [
    { type: "text", value: "see " },
    { type: "deal", dealId: "abc123", dealName: "Acme Corp" },
    { type: "text", value: " today" },
  ]);
});

test("unresolved deal chip falls back to plain id text", () => {
  const out = renderAdminChatContent(
    "see [deal:missing] gone",
    { deals: {} }
  );
  assert.deepEqual(out, [
    { type: "text", value: "see " },
    { type: "deal", dealId: "missing", dealName: null },
    { type: "text", value: " gone" },
  ]);
});

test("mixed mention + deal chip", () => {
  const out = renderAdminChatContent(
    "@[Jane](j@x.com) about [deal:d1]?",
    { deals: { d1: "Wid Co" } }
  );
  assert.deepEqual(out, [
    { type: "mention", email: "j@x.com", name: "Jane" },
    { type: "text", value: " about " },
    { type: "deal", dealId: "d1", dealName: "Wid Co" },
    { type: "text", value: "?" },
  ]);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
