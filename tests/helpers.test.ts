import { describe, expect, test } from "bun:test";
import { InvalidDateError } from "../src/errors";
import {
	capitalize,
	decodeCookieValue,
	encodeCookieValue,
	formatHttpDate,
	isValidCookieName,
	lowercase,
	unquoteCookieValue,
} from "../src/helpers";

describe("helpers", () => {
	describe("formatHttpDate", () => {
		test("formats valid date correctly", () => {
			const date = new Date("Wed, 09 Jun 2021 10:18:14 GMT");
			expect(formatHttpDate(date)).toBe("Wed, 09 Jun 2021 10:18:14 GMT");
		});

		test("throws InvalidDateError for invalid date", () => {
			expect(() => formatHttpDate(new Date("invalid"))).toThrow(
				InvalidDateError,
			);
		});

		test("throws InvalidDateError for null", () => {
			// @ts-expect-error
			expect(() => formatHttpDate(null)).toThrow(InvalidDateError);
		});

		test("throws InvalidDateError for undefined", () => {
			// @ts-expect-error
			expect(() => formatHttpDate(undefined)).toThrow(InvalidDateError);
		});

		test("throws InvalidDateError for non-Date object", () => {
			// @ts-expect-error
			expect(() => formatHttpDate("2021-01-01")).toThrow(InvalidDateError);
		});
	});

	describe("isValidCookieName", () => {
		test("returns true for valid cookie names", () => {
			expect(isValidCookieName("test")).toBe(true);
			expect(isValidCookieName("cookie123")).toBe(true);
			expect(isValidCookieName("my-cookie")).toBe(true);
			expect(isValidCookieName("_session")).toBe(true);
			expect(isValidCookieName("MY_COOKIE")).toBe(true);
		});

		test("returns false for names with spaces", () => {
			expect(isValidCookieName("test cookie")).toBe(false);
		});

		test("returns false for names with semicolons", () => {
			expect(isValidCookieName("test;cookie")).toBe(false);
		});

		test("returns false for names with commas", () => {
			expect(isValidCookieName("test,cookie")).toBe(false);
		});

		test("returns false for names with equals", () => {
			expect(isValidCookieName("test=cookie")).toBe(false);
		});

		test("returns false for names with quotes", () => {
			expect(isValidCookieName('"test"')).toBe(false);
		});

		test("returns false for empty string", () => {
			expect(isValidCookieName("")).toBe(false);
		});

		test("returns false for control characters", () => {
			expect(isValidCookieName("test\ncookie")).toBe(false);
			expect(isValidCookieName("test\tcookie")).toBe(false);
		});
	});

	describe("unquoteCookieValue", () => {
		test("unquotes quoted values", () => {
			expect(unquoteCookieValue('"test"')).toBe("test");
			expect(unquoteCookieValue('"value with spaces"')).toBe(
				"value with spaces",
			);
		});

		test("unescapes escaped quotes", () => {
			expect(unquoteCookieValue('"value \\"with\\" quotes"')).toBe(
				'value "with" quotes',
			);
		});

		test("unescapes escaped backslashes", () => {
			expect(unquoteCookieValue('"path\\\\to\\\\file"')).toBe("path\\to\\file");
		});

		test("returns unquoted values unchanged", () => {
			expect(unquoteCookieValue("test")).toBe("test");
			expect(unquoteCookieValue("value123")).toBe("value123");
		});

		test("handles values with only opening quote", () => {
			expect(unquoteCookieValue('"test')).toBe('"test');
		});

		test("handles values with only closing quote", () => {
			expect(unquoteCookieValue('test"')).toBe('test"');
		});

		test("handles empty string", () => {
			expect(unquoteCookieValue("")).toBe("");
		});

		test("handles quoted empty string", () => {
			expect(unquoteCookieValue('""')).toBe("");
		});
	});

	describe("decodeCookieValue", () => {
		test("decodes URL-encoded values", () => {
			expect(decodeCookieValue("hello%20world")).toBe("hello world");
			expect(decodeCookieValue("E%3Dmc%5E2")).toBe("E=mc^2");
		});

		test("unquotes and decodes quoted values", () => {
			expect(decodeCookieValue('"hello%20world"')).toBe("hello world");
		});

		test("handles unencoded values", () => {
			expect(decodeCookieValue("simple")).toBe("simple");
			expect(decodeCookieValue("test123")).toBe("test123");
		});

		test("handles empty string", () => {
			expect(decodeCookieValue("")).toBe("");
		});

		test("returns original value if decoding fails", () => {
			// Invalid UTF-8 sequence that can't be decoded
			expect(decodeCookieValue("%E0%A4%A")).toBe("%E0%A4%A");
		});

		test("handles quoted values with escaped characters", () => {
			expect(decodeCookieValue('"value \\"with\\" quotes"')).toBe(
				'value "with" quotes',
			);
		});
	});

	describe("encodeCookieValue", () => {
		test("returns simple values unchanged", () => {
			expect(encodeCookieValue("test")).toBe("test");
			expect(encodeCookieValue("value123")).toBe("value123");
			expect(encodeCookieValue("my-value")).toBe("my-value");
		});

		test("quotes values with spaces", () => {
			expect(encodeCookieValue("value with spaces")).toBe(
				'"value with spaces"',
			);
		});

		test("quotes values with semicolons", () => {
			expect(encodeCookieValue("bar;with;semicolons")).toBe(
				'"bar;with;semicolons"',
			);
		});

		test("quotes and escapes values with quotes", () => {
			expect(encodeCookieValue('value "with" quotes')).toBe(
				'"value \\"with\\" quotes"',
			);
		});

		test("quotes and escapes values with backslashes", () => {
			expect(encodeCookieValue("path\\to\\file")).toBe('"path\\\\to\\\\file"');
		});

		test("URL-encodes non-ASCII characters", () => {
			expect(encodeCookieValue("🎉")).toBe("%F0%9F%8E%89");
			expect(encodeCookieValue("café")).toBe("caf%C3%A9");
		});

		test("URL-encodes control characters", () => {
			expect(encodeCookieValue("hello\nworld")).toBe("hello%0Aworld");
			expect(encodeCookieValue("tab\there")).toBe("tab%09here");
		});

		test("handles empty string", () => {
			expect(encodeCookieValue("")).toBe("");
		});

		test("handles values with = and ^ (no encoding needed)", () => {
			expect(encodeCookieValue("E=mc^2")).toBe("E=mc^2");
		});
	});

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
			const result: Lowercase<"STRICT"> = lowercase("STRICT");
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
			const result: Capitalize<"strict"> = capitalize("strict");
			expect(result).toBe("Strict");
		});
	});
});
