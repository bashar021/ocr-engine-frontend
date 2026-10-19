import { describe, expect, it } from "vitest";
import { parseNumericalValue } from "./DatabankListPage";

describe("parseNumericalValue", () => {
  it("parses pure integers", () => {
    expect(parseNumericalValue("12345")).toBe("12345");
    expect(parseNumericalValue("00123")).toBe("00123");
    expect(parseNumericalValue("0")).toBe("0");
  });

  it("parses decimal values", () => {
    expect(parseNumericalValue("1234.5")).toBe("1234.5");
    expect(parseNumericalValue("0.5")).toBe("0.5");
  });

  it("strips comma thousand separators", () => {
    expect(parseNumericalValue("12,345")).toBe("12345");
    expect(parseNumericalValue("1,234,567.89")).toBe("1234567.89");
  });

  it("strips markdown code fences", () => {
    expect(parseNumericalValue("```\n45210\n```")).toBe("45210");
    expect(parseNumericalValue("```json\n54321\n```")).toBe("54321");
    expect(parseNumericalValue("```text\n9876.5\n```")).toBe("9876.5");
  });

  it("strips surrounding quotes and spaces", () => {
    expect(parseNumericalValue('  "12345"  ')).toBe("12345");
    expect(parseNumericalValue(" '999' ")).toBe("999");
  });

  it("returns null for non-numerical texts", () => {
    expect(parseNumericalValue("null")).toBeNull();
    expect(parseNumericalValue("None")).toBeNull();
    expect(parseNumericalValue("No digits visible")).toBeNull();
    expect(parseNumericalValue("abc123")).toBeNull();
    expect(parseNumericalValue("blurry")).toBeNull();
    expect(parseNumericalValue("N/A")).toBeNull();
    expect(parseNumericalValue("")).toBeNull();
    expect(parseNumericalValue(null)).toBeNull();
    expect(parseNumericalValue(undefined)).toBeNull();
  });
});
