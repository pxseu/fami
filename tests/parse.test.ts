import { describe, expect, test } from "bun:test";
import { parse } from "../src";

describe("parse", () => {
	describe("basic parsing", () => {
		test("parses single cookie", () => {
			const result = parse("test=value");

			expect(result).toEqual({
				test: "value",
			});
		});

		test("parses multiple cookies", () => {
			const result = parse("cookie1=value1; cookie2=value2; cookie3=value3");

			expect(result).toEqual({
				cookie1: "value1",
				cookie2: "value2",
				cookie3: "value3",
			});
		});

		test("handles comma separation (legacy)", () => {
			const result = parse("cookie1=value1, cookie2=value2");

			expect(result).toEqual({
				cookie1: "value1",
				cookie2: "value2",
			});
		});

		test("handles empty values", () => {
			const result = parse("test=");

			expect(result).toEqual({
				test: "",
			});
		});

		test("handles duplicate cookie names (first one wins)", () => {
			const result = parse("test=first; test=second; test=third");

			expect(result).toEqual({
				test: "first",
			});
		});
	});

	describe("quoted values", () => {
		test("handles quoted values", () => {
			const result = parse('test="quoted value"');

			expect(result).toEqual({
				test: "quoted value",
			});
		});

		test("treats single quotes as part of the value (not RFC compliant)", () => {
			const result = parse("test='single quoted'");

			expect(result).toEqual({
				test: "'single quoted'",
			});
		});

		test("handles escaped quotes in quoted values", () => {
			const result = parse('test="value \\"with\\" quotes"');

			expect(result).toEqual({
				test: 'value "with" quotes',
			});
		});

		test("handles escaped backslashes in quoted values", () => {
			const result = parse('test="path\\\\to\\\\file"');

			expect(result).toEqual({
				test: "path\\to\\file",
			});
		});
	});

	describe("special characters", () => {
		test("handles values with special characters", () => {
			const result = parse("test=value with spaces");

			expect(result).toEqual({
				test: "value with spaces",
			});
		});

		test("handles multiple equals signs in value", () => {
			const result = parse("test=name=value");

			expect(result).toEqual({
				test: "name=value",
			});
		});

		test("handles tab characters as whitespace", () => {
			const result = parse("test=value;\tcookie2\t=\tvalue2");

			expect(result).toEqual({
				test: "value",
				cookie2: "value2",
			});
		});

		test("handles values with = and ^ characters", () => {
			const result = parse("foo=E=mc^2");

			expect(result).toEqual({
				foo: "E=mc^2",
			});
		});

		test("handles values with only opening quote", () => {
			const result = parse('test="');

			expect(result).toEqual({
				test: '"',
			});
		});
	});

	describe("encoded values", () => {
		test("handles encoded values", () => {
			const result = parse("foo=bar; equation=E%3Dmc%5E2");

			expect(result).toEqual({
				foo: "bar",
				equation: "E=mc^2",
			});
		});

		test("handles encoded values with special characters", () => {
			const result = parse(`foo="bar%3Bwith%3Bsemicolons"`);

			expect(result).toEqual({
				foo: "bar;with;semicolons",
			});
		});
	});

	describe("invalid input handling", () => {
		test("skips invalid cookies in header", () => {
			const result = parse("valid=cookie; invalid cookie; another=valid");

			expect(result).toEqual({
				valid: "cookie",
				another: "valid",
			});
		});

		test("ignores cookies with invalid names", () => {
			const result = parse("valid=cookie; test name=value; another=valid");

			expect(result).toEqual({
				valid: "cookie",
				another: "valid",
			});
		});

		test("returns empty object for invalid input", () => {
			for (const input of ["", "   ", null, undefined]) {
				const result = parse(input as string);
				expect(result).toEqual({});
			}
		});
	});

	describe("real-world scenarios", () => {
		test("handles real-world cookie headers", () => {
			const realWorldHeaders = [
				"sessionid=abc123; csrftoken=def456; user_pref=dark_mode",
				"_ga=GA1.2.123456789.1234567890; _gid=GA1.2.987654321.0987654321",
				"session=eyJhbGciOiJIUzI1NiJ9; auth=bearer_token_here",
			];

			for (const header of realWorldHeaders) {
				const result = parse(header);

				expect(Object.keys(result).length).toBeGreaterThan(0);
			}
		});
	});

	describe("prototype pollution protection", () => {
		test("handles __proto__ as cookie name", () => {
			const result = parse("__proto__=polluted; session=abc123");

			expect(result.session).toBe("abc123");
			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			expect(result.__proto__).toBe("polluted");
			expect(({} as Record<string, unknown>).polluted).toBeUndefined();
		});

		test("handles constructor as cookie name", () => {
			const result = parse("constructor=evil; session=abc123");

			expect(result.session).toBe("abc123");
			expect(Object.hasOwn(result, "constructor")).toBe(true);
			expect(result.constructor as unknown as string).toBe("evil");
		});

		test("handles prototype as cookie name", () => {
			const result = parse("prototype=evil; session=abc123");

			expect(result.session).toBe("abc123");
			expect(Object.hasOwn(result, "prototype")).toBe(true);
			expect((result as Record<string, unknown>).prototype).toBe("evil");
		});

		test("handles multiple dangerous keys", () => {
			const result = parse(
				"__proto__=a; constructor=b; prototype=c; __defineGetter__=d",
			);

			expect(Object.keys(result)).toEqual([
				"__proto__",
				"constructor",
				"prototype",
				"__defineGetter__",
			]);
			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			expect(Object.hasOwn(result, "constructor")).toBe(true);
		});

		test("does not pollute Object.prototype", () => {
			parse("__proto__=polluted; constructor=evil");

			expect(({} as Record<string, unknown>).polluted).toBeUndefined();
			expect(Object.keys(Object.prototype)).toEqual([]);
		});
	});
});
