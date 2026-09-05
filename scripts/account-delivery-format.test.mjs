import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../server.js", import.meta.url), "utf8");
const start = source.indexOf("function formatAccountDelivery(value)");
const end = source.indexOf("\n\nfunction buildCheckoutDeliveryItem", start);
assert.ok(start >= 0 && end > start, "account formatter must remain defined");
const context = vm.createContext({});
vm.runInContext(`${source.slice(start, end)}; globalThis.formatAccountDelivery = formatAccountDelivery;`, context);

const formatted = context.formatAccountDelivery(
  "Xbox E-mail: xbox@example.com Password: first | Alternate Email: alt@example.com Password: second | Ubisoft (do not login with this): ubisoft@example.com:third | https://siegeskins.dev/profile/test"
);
assert.equal(
  formatted,
  "Xbox Email: xbox@example.com Password: first | Alternate Email: alt@example.com Password: second | Ubisoft (DONT LOGIN W THIS): ubisoft@example.com:third | https://siegeskins.dev/profile/test"
);
assert.equal(context.formatAccountDelivery("@everyone\nXbox Email: a@example.com Password: p"), "Xbox Email: a@example.com Password: p");
assert.equal(context.formatAccountDelivery(""), "");
console.log("Account delivery formatter: 3 behavior checks passed.");
