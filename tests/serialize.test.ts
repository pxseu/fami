import { describe, expect, test } from "bun:test";
import {
	InvalidAttributeError,
	InvalidDateError,
	InvalidNameError,
	parse,
	serialize,
} from "../src";

describe("serialize", () => {
	describe("basic serialization", () => {
		test("serializes basic cookie", () => {
			const result = serialize("test", "value");
			expect(result).toBe("test=value");
		});

		test("serializes cookie with all attributes", () => {
			const result = serialize("test", "value", {
				expires: new Date("Wed, 09 Jun 2021 10:18:14 GMT"),
				maxAge: 3600,
				domain: "example.com",
				path: "/",
				secure: true,
				httpOnly: true,
				sameSite: "strict",
				partitioned: true,
				priority: "high",
			});

			expect(result).toBe(
				"test=value; Expires=Wed, 09 Jun 2021 10:18:14 GMT; Max-Age=3600; Domain=example.com; Path=/; Secure; HttpOnly; Partitioned; Priority=High; SameSite=Strict",
			);
		});

		test("handles empty value", () => {
			const result = serialize("test", "");
			expect(result).toBe("test=");
		});
	});

	describe("value encoding", () => {
		test("quotes values with special characters", () => {
			const result = serialize("test", "value with spaces");
			expect(result).toBe('test="value with spaces"');
		});

		test("escapes quotes in values", () => {
			const result = serialize("test", 'value "with" quotes');
			expect(result).toBe('test="value \\"with\\" quotes"');
		});

		test("handles values with backslashes (escapes them)", () => {
			const result = serialize("test", "path\\to\\file");
			expect(result).toBe('test="path\\\\to\\\\file"');
		});

		test("handles values with = and ^ characters", () => {
			const result = serialize("foo", "E=mc^2");
			expect(result).toBe("foo=E=mc^2");
		});

		test("encodes values with semicolons to preserve round-trips", () => {
			const result = serialize("foo", "bar;with;semicolons");
			expect(result).toBe("foo=bar%3Bwith%3Bsemicolons");
		});

		test("round-trips semicolons through parse", () => {
			const serialized = serialize("foo", "bar;with;semicolons");
			const parsed = parse(serialized);
			expect(parsed.foo).toBe("bar;with;semicolons");
		});

		test("encodes non-ASCII characters (fallback to encoding)", () => {
			const result = serialize("emoji", "🎉");
			expect(result).toBe("emoji=%F0%9F%8E%89");
		});

		test("encodes control characters (fallback to encoding)", () => {
			const result = serialize("test", "hello\nworld");
			expect(result).toBe("test=hello%0Aworld");
		});
	});

	describe("maxAge attribute", () => {
		test("handles zero max-age", () => {
			const result = serialize("test", "value", { maxAge: 0 });
			expect(result).toBe("test=value; Max-Age=0");
		});

		test("ignores negative max-age", () => {
			const result = serialize("test", "value", { maxAge: -1 });
			expect(result).toBe("test=value");
			expect(result).not.toContain("Max-Age");
		});
	});

	describe("sameSite attribute", () => {
		test("handles strict value", () => {
			expect(serialize("test", "value", { sameSite: "strict" })).toBe(
				"test=value; SameSite=Strict",
			);
		});

		test("handles lax value", () => {
			expect(serialize("test", "value", { sameSite: "lax" })).toBe(
				"test=value; SameSite=Lax",
			);
		});

		test("handles none value", () => {
			expect(serialize("test", "value", { sameSite: "none" })).toBe(
				"test=value; SameSite=None",
			);
		});

		test("throws error for invalid value", () => {
			expect(() =>
				serialize("test", "value", { sameSite: "Invalid" as "strict" }),
			).toThrow(InvalidAttributeError);
			expect(() =>
				serialize("test", "value", { sameSite: "Invalid" as "strict" }),
			).toThrow("Invalid SameSite value");
		});
	});

	describe("priority attribute", () => {
		test("handles low value", () => {
			const result = serialize("test", "value", { priority: "low" });
			expect(result).toBe("test=value; Priority=Low");
		});

		test("handles medium value", () => {
			const result = serialize("test", "value", { priority: "medium" });
			expect(result).toBe("test=value; Priority=Medium");
		});

		test("handles high value", () => {
			const result = serialize("test", "value", { priority: "high" });
			expect(result).toBe("test=value; Priority=High");
		});

		test("throws error for invalid value", () => {
			expect(() =>
				serialize("test", "value", { priority: "invalid" as "low" }),
			).toThrow(InvalidAttributeError);
			expect(() =>
				serialize("test", "value", { priority: "invalid" as "low" }),
			).toThrow("Invalid priority value");
		});
	});

	describe("partitioned attribute", () => {
		test("handles partitioned attribute", () => {
			const result = serialize("test", "value", { partitioned: true });
			expect(result).toBe("test=value; Partitioned");
		});

		test("ignores partitioned attribute when false", () => {
			const result = serialize("test", "value", { partitioned: false });
			expect(result).toBe("test=value");
			expect(result).not.toContain("Partitioned");
		});

		test("handles cookie with both partitioned and priority", () => {
			const result = serialize("test", "value", {
				partitioned: true,
				priority: "high",
			});
			expect(result).toBe("test=value; Partitioned; Priority=High");
		});
	});

	describe("error handling", () => {
		test("throws error for missing name", () => {
			// @ts-expect-error
			expect(() => serialize()).toThrow(InvalidNameError);
			// @ts-expect-error
			expect(() => serialize()).toThrow("Name is required");
		});

		test("throws error for invalid name", () => {
			expect(() => serialize("invalid name", "value")).toThrow(
				InvalidNameError,
			);
			expect(() => serialize("invalid name", "value")).toThrow("Invalid name");
		});

		test("throws error for invalid date", () => {
			expect(() =>
				serialize("test", "value", { expires: new Date("invalid") }),
			).toThrow(InvalidDateError);
			expect(() =>
				serialize("test", "value", { expires: new Date("invalid") }),
			).toThrow("Invalid date");
		});

		test("throws error for invalid domain", () => {
			expect(() =>
				serialize("test", "value", { domain: "example.com\r\nX-Test: 1" }),
			).toThrow(InvalidAttributeError);
		});

		test("throws error for invalid path", () => {
			expect(() =>
				serialize("test", "value", { path: "/\r\nX-Test: 1" }),
			).toThrow(InvalidAttributeError);
		});
	});
});
