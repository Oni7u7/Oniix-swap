import { describe, expect, it } from "vitest";
import { fromBaseUnits, isValidDecimalAmount, toBaseUnits } from "./format";

describe("toBaseUnits", () => {
  it("converts whole amounts respecting decimals", () => {
    expect(toBaseUnits("100", 6)).toBe("100000000");
    expect(toBaseUnits("1", 18)).toBe("1000000000000000000");
  });

  it("converts fractional amounts", () => {
    expect(toBaseUnits("1.5", 18)).toBe("1500000000000000000");
    expect(toBaseUnits("0.000001", 6)).toBe("1");
  });

  it("handles BTC-style 8 decimal tokens", () => {
    expect(toBaseUnits("0.00000001", 8)).toBe("1");
    expect(toBaseUnits("1", 8)).toBe("100000000");
  });

  it("rejects zero, negative, empty, and malformed input", () => {
    expect(() => toBaseUnits("0", 18)).toThrow();
    expect(() => toBaseUnits("0.0", 18)).toThrow();
    expect(() => toBaseUnits("-1", 18)).toThrow();
    expect(() => toBaseUnits("", 18)).toThrow();
    expect(() => toBaseUnits("1e18", 18)).toThrow();
    expect(() => toBaseUnits("abc", 18)).toThrow();
    expect(() => toBaseUnits("1,5", 18)).toThrow();
  });
});

describe("fromBaseUnits", () => {
  it("converts base units back to human amounts", () => {
    expect(fromBaseUnits("100000000", 6)).toBe("100");
    expect(fromBaseUnits("1500000000000000000", 18)).toBe("1.5");
    expect(fromBaseUnits("1", 8)).toBe("0.00000001");
  });

  it("rejects non-integer or malformed base units", () => {
    expect(() => fromBaseUnits("1.5", 18)).toThrow();
    expect(() => fromBaseUnits("-1", 18)).toThrow();
    expect(() => fromBaseUnits("abc", 18)).toThrow();
  });
});

describe("isValidDecimalAmount", () => {
  it("accepts positive decimals and integers", () => {
    expect(isValidDecimalAmount("1")).toBe(true);
    expect(isValidDecimalAmount("0.5")).toBe(true);
    expect(isValidDecimalAmount("1000000")).toBe(true);
  });

  it("rejects zero in any form, and invalid formats", () => {
    expect(isValidDecimalAmount("0")).toBe(false);
    expect(isValidDecimalAmount("0.0")).toBe(false);
    expect(isValidDecimalAmount("0.000")).toBe(false);
    expect(isValidDecimalAmount("-1")).toBe(false);
    expect(isValidDecimalAmount("1e5")).toBe(false);
    expect(isValidDecimalAmount("")).toBe(false);
    expect(isValidDecimalAmount(".5")).toBe(false);
  });
});
