// stock/tests/data.test.js
import { describe, it, expect } from "vitest";
import { isValidTicker } from "../data.js";

describe("isValidTicker", () => {
  it("accepts 1-6 uppercase letters", () => {
    expect(isValidTicker("A")).toBe(true);
    expect(isValidTicker("AAPL")).toBe(true);
    expect(isValidTicker("GOOGL")).toBe(true);
    expect(isValidTicker("ABCDEF")).toBe(true);
  });

  it("accepts an optional .XXX suffix", () => {
    expect(isValidTicker("BRK.B")).toBe(true);
    expect(isValidTicker("RDS.A")).toBe(true);
  });

  it("rejects lowercase, digits, whitespace, and over-length symbols", () => {
    expect(isValidTicker("aapl")).toBe(false);
    expect(isValidTicker("AAPL1")).toBe(false);
    expect(isValidTicker(" AAPL")).toBe(false);
    expect(isValidTicker("ABCDEFG")).toBe(false);
    expect(isValidTicker("")).toBe(false);
    expect(isValidTicker("AA..B")).toBe(false);
    expect(isValidTicker(null)).toBe(false);
    expect(isValidTicker(123)).toBe(false);
  });
});
