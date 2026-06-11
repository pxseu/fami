import { describe, expect, test } from "bun:test";
import { parse } from "../src";

describe("parse", () => {
	describe("basic parsing", () => {
		test("parses single cookie", () => {
			expect(parse("test=value")).toEqual({ test: "value" });
		});

		test("parses multiple cookies", () => {
			expect(parse("cookie1=value1; cookie2=value2; cookie3=value3")).toEqual({
				cookie1: "value1",
				cookie2: "value2",
				cookie3: "value3",
			});
		});

		test("handles comma separation (legacy)", () => {
			expect(parse("cookie1=value1, cookie2=value2")).toEqual({
				cookie1: "value1",
				cookie2: "value2",
			});
		});

		test("merges repeated Cookie header fields", () => {
			expect(
				parse(["cookie1=value1; cookie2=value2", "cookie3=value3"]),
			).toEqual({
				cookie1: "value1",
				cookie2: "value2",
				cookie3: "value3",
			});
		});

		test("handles empty values", () => {
			expect(parse("test=")).toEqual({ test: "" });
		});

		test("handles duplicate cookie names (first one wins)", () => {
			expect(parse("test=first; test=second; test=third")).toEqual({
				test: "first",
			});
			expect(parse("test=; test=second")).toEqual({ test: "" });
		});
	});

	describe("quoted values", () => {
		test("strips surrounding double quotes", () => {
			expect(parse('test="quoted value"')).toEqual({ test: "quoted value" });
		});

		test("treats single quotes as part of the value (not RFC compliant)", () => {
			expect(parse("test='single quoted'")).toEqual({
				test: "'single quoted'",
			});
		});

		test('unescapes \\" and \\\\ inside quoted values', () => {
			expect(parse('test="value \\"with\\" quotes"')).toEqual({
				test: 'value "with" quotes',
			});
			expect(parse('test="path\\\\to\\\\file"')).toEqual({
				test: "path\\to\\file",
			});
		});
	});

	describe("special characters", () => {
		test("preserves spaces, equals, and ^ in values", () => {
			expect(parse("test=value with spaces")).toEqual({
				test: "value with spaces",
			});
			expect(parse("test=name=value")).toEqual({ test: "name=value" });
			expect(parse("foo=E=mc^2")).toEqual({ foo: "E=mc^2" });
		});

		test("treats tabs as whitespace", () => {
			expect(parse("test=value;\tcookie2\t=\tvalue2")).toEqual({
				test: "value",
				cookie2: "value2",
			});
		});

		test("preserves newlines and carriage returns in values", () => {
			expect(parse("test=hello\nworld")).toEqual({ test: "hello\nworld" });
			expect(parse("test=hello\rworld")).toEqual({ test: "hello\rworld" });
		});

		test("handles a stray opening quote", () => {
			expect(parse('test="')).toEqual({ test: '"' });
		});

		test("trims whitespace around quoted values", () => {
			expect(parse('test=      "hello world"        ')).toEqual({
				test: "hello world",
			});
			expect(parse('test=\t\t\t\t"hello world"\t\t\t    ')).toEqual({
				test: "hello world",
			});
		});

		test("preserves newlines inside quoted values", () => {
			expect(parse('test="hello\nworld"')).toEqual({ test: "hello\nworld" });
		});
	});

	describe("encoded values", () => {
		test("decodes percent-encoded values", () => {
			expect(parse("foo=bar; equation=E%3Dmc%5E2")).toEqual({
				foo: "bar",
				equation: "E=mc^2",
			});
		});

		test("decodes encoded values inside quotes", () => {
			expect(parse(`foo="bar%3Bwith%3Bsemicolons"`)).toEqual({
				foo: "bar;with;semicolons",
			});
		});
	});

	describe("invalid input handling", () => {
		test("skips entries without a valid name=value shape", () => {
			expect(parse("valid=cookie; invalid cookie; another=valid")).toEqual({
				valid: "cookie",
				another: "valid",
			});
		});

		test("skips cookies with invalid names", () => {
			expect(parse("valid=cookie; test name=value; another=valid")).toEqual({
				valid: "cookie",
				another: "valid",
			});
		});

		test("skips cookie names with invalid characters", () => {
			expect(parse("valid=cookie; café=value; token~=allowed")).toEqual({
				valid: "cookie",
				"token~": "allowed",
			});
		});

		test("returns empty object for empty or null input", () => {
			for (const input of ["", "   ", null, undefined]) {
				expect(parse(input as string)).toEqual({});
			}
		});
	});

	describe("real-world scenarios", () => {
		test("parses session and CSRF style headers", () => {
			expect(
				parse("sessionid=abc123; csrftoken=def456; user_pref=dark_mode"),
			).toEqual({
				sessionid: "abc123",
				csrftoken: "def456",
				user_pref: "dark_mode",
			});
		});

		test("parses analytics cookies with dotted values", () => {
			expect(
				parse(
					"_ga=GA1.2.123456789.1234567890; _gid=GA1.2.987654321.0987654321",
				),
			).toEqual({
				_ga: "GA1.2.123456789.1234567890",
				_gid: "GA1.2.987654321.0987654321",
			});
		});

		test("parses token-like values", () => {
			expect(
				parse("session=eyJhbGciOiJIUzI1NiJ9; auth=bearer_token_here"),
			).toEqual({
				session: "eyJhbGciOiJIUzI1NiJ9",
				auth: "bearer_token_here",
			});
		});
	});

	describe("null-prototype storage", () => {
		test("stores reserved-key cookies as own properties", () => {
			const result = parse(
				"__proto__=polluted; constructor=evil; prototype=evil2; session=abc123",
			);

			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			expect(Object.hasOwn(result, "constructor")).toBe(true);
			expect(Object.hasOwn(result, "prototype")).toBe(true);
			expect(result.__proto__).toBe("polluted");
			expect(result.constructor as unknown as string).toBe("evil");
			expect((result as Record<string, unknown>).prototype).toBe("evil2");
			expect(result.session).toBe("abc123");
		});

		test("preserves key order across reserved names", () => {
			const result = parse(
				"__proto__=a; constructor=b; prototype=c; __defineGetter__=d",
			);

			expect(Object.keys(result)).toEqual([
				"__proto__",
				"constructor",
				"prototype",
				"__defineGetter__",
			]);
		});

		test("does not mutate Object.prototype", () => {
			parse("__proto__=polluted; constructor=evil");

			expect(({} as Record<string, unknown>).polluted).toBeUndefined();
			expect(Object.keys(Object.prototype)).toEqual([]);
		});
	});
});
