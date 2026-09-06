import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { normalizeStatus, parseStatusChangeEmbed } = require("./status-sync.js");

test("status values are mapped exactly", () => {
  assert.equal(normalizeStatus("Undetected"), "undetected");
  assert.equal(normalizeStatus("Updating"), "updating");
  assert.equal(normalizeStatus("Detected"), "detected");
  assert.equal(normalizeStatus("Testing"), null);
});

test("Status Change embeds return the product and new status", () => {
  assert.deepEqual(parseStatusChangeEmbed({
    title: "Status Change",
    fields: [
      { name: "Product", value: "Exodus - Fortnite" },
      { name: "Changed from", value: "Undetected" },
      { name: "New Status", value: "Updating" },
    ],
  }), {
    product: "Exodus - Fortnite",
    status: "updating",
    changedFrom: "Undetected",
  });
  assert.equal(parseStatusChangeEmbed({ title: "Other", fields: [] }), null);
});
