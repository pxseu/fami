import { describe, expect, test } from "bun:test";
import { encodeCookieValue } from "../../src/helpers";

describe("encodeCookieValue", () => {
	describe("simple values", () => {
		test("returns simple values unchanged", () => {
			expect(encodeCookieValue("test")).toBe("test");
			expect(encodeCookieValue("value123")).toBe("value123");
			expect(encodeCookieValue("my-value")).toBe("my-value");
		});

		test("handles values with = and ^ (no encoding needed)", () => {
			expect(encodeCookieValue("E=mc^2")).toBe("E=mc^2");
		});

		test("handles empty string", () => {
			expect(encodeCookieValue("")).toBe("");
		});
	});

	describe("URL encoding", () => {
		test("URL-encodes values with spaces", () => {
			expect(encodeCookieValue("value with spaces")).toBe(
				"value%20with%20spaces",
			);
		});

		test("encodes semicolons", () => {
			expect(encodeCookieValue("bar;with;semicolons")).toBe(
				"bar%3Bwith%3Bsemicolons",
			);
		});

		test("URL-encodes values with quotes", () => {
			expect(encodeCookieValue('value "with" quotes')).toBe(
				"value%20%22with%22%20quotes",
			);
		});

		test("URL-encodes values with backslashes", () => {
			expect(encodeCookieValue("path\\to\\file")).toBe("path%5Cto%5Cfile");
		});

		test("URL-encodes non-ASCII characters", () => {
			expect(encodeCookieValue("🎉")).toBe("%F0%9F%8E%89");
			expect(encodeCookieValue("café")).toBe("caf%C3%A9");
		});

		test("URL-encodes control characters", () => {
			expect(encodeCookieValue("hello\nworld")).toBe("hello%0Aworld");
			expect(encodeCookieValue("tab\there")).toBe("tab%09here");
		});
	});
});
