import { describe, expect, test } from "bun:test";
import { capitalize, lowercase } from "../../src/helpers";

describe("helpers", () => {
	describe("lowercase", () => {
		test("converts string to lowercase", () => {
			expect(lowercase("TEST")).toBe("test");
			expect(lowercase("Hello")).toBe("hello");
			expect(lowercase("MiXeD")).toBe("mixed");
		});

		test("handles already lowercase strings", () => {
			expect(lowercase("test")).toBe("test");
		});

		test("handles empty string", () => {
			expect(lowercase("")).toBe("");
		});

		test("preserves TypeScript type", () => {
			const result: "strict" = lowercase("STRICT");
			expect(result).toBe("strict");
		});
	});

	describe("capitalize", () => {
		test("capitalizes first letter", () => {
			expect(capitalize("test")).toBe("Test");
			expect(capitalize("hello")).toBe("Hello");
		});

		test("handles already capitalized strings", () => {
			expect(capitalize("Test")).toBe("Test");
		});

		test("capitalizes lowercase words", () => {
			expect(capitalize("strict")).toBe("Strict");
			expect(capitalize("lax")).toBe("Lax");
			expect(capitalize("none")).toBe("None");
		});

		test("handles single character", () => {
			expect(capitalize("a")).toBe("A");
		});

		test("handles empty string", () => {
			expect(capitalize("")).toBe("");
		});

		test("preserves TypeScript type", () => {
			const result: "Strict" = capitalize("strict");
			expect(result).toBe("Strict");
		});
	});
});
