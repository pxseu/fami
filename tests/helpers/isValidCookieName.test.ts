import { describe, expect, test } from "bun:test";
import { isValidCookieName } from "../../src/helpers";

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
