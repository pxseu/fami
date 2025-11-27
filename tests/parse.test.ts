import { describe, expect, test } from "bun:test";
import { parse } from "../src";

describe("parse", () => {
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

	test("handles empty values", () => {
		const result = parse("test=");

		expect(result).toEqual({
			test: "",
		});
	});

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

	test("handles tab characters as whitespace", () => {
		const result = parse("test=value;\tcookie2\t=\tvalue2");

		expect(result).toEqual({
			test: "value",
			cookie2: "value2",
		});
	});

	test("handles duplicate cookie names (last wins)", () => {
		const result = parse("test=first; test=second; test=third");

		expect(result).toEqual({
			test: "third",
		});
	});

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

	test("handles values with = and ^ characters", () => {
		const result = parse("foo=E=mc^2");

		expect(result).toEqual({
			foo: "E=mc^2",
		});
	});
});
