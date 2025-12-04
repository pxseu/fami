import { describe, expect, test } from "bun:test";
import { decodeCookieValue } from "../../src/helpers";

describe("decodeCookieValue", () => {
	describe("URL decoding", () => {
		test("decodes URL-encoded values", () => {
			expect(decodeCookieValue("hello%20world")).toBe("hello world");
			expect(decodeCookieValue("E%3Dmc%5E2")).toBe("E=mc^2");
		});

		test("returns original value if decoding fails", () => {
			// Invalid UTF-8 sequence that can't be decoded
			expect(decodeCookieValue("%E0%A4%A")).toBe("%E0%A4%A");
		});

		test("handles unencoded values", () => {
			expect(decodeCookieValue("simple")).toBe("simple");
			expect(decodeCookieValue("test123")).toBe("test123");
		});
	});

	describe("quoted values", () => {
		test("unquotes quoted values", () => {
			expect(decodeCookieValue('"test"')).toBe("test");
			expect(decodeCookieValue('"value with spaces"')).toBe(
				"value with spaces",
			);
		});

		test("unquotes and decodes quoted values", () => {
			expect(decodeCookieValue('"hello%20world"')).toBe("hello world");
		});

		test("handles values with only opening quote", () => {
			expect(decodeCookieValue('"test')).toBe('"test');
		});

		test("handles values with only closing quote", () => {
			expect(decodeCookieValue('test"')).toBe('test"');
		});

		test("handles quoted empty string", () => {
			expect(decodeCookieValue('""')).toBe("");
		});
	});

	describe("escaped characters", () => {
		test("unescapes escaped quotes", () => {
			expect(decodeCookieValue('"value \\"with\\" quotes"')).toBe(
				'value "with" quotes',
			);
		});

		test("unescapes escaped backslashes", () => {
			expect(decodeCookieValue('"path\\\\to\\\\file"')).toBe("path\\to\\file");
		});
	});

	describe("edge cases", () => {
		test("handles empty string", () => {
			expect(decodeCookieValue("")).toBe("");
		});

		test("returns unquoted values unchanged", () => {
			expect(decodeCookieValue("test")).toBe("test");
			expect(decodeCookieValue("value123")).toBe("value123");
		});
	});
});
