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
			expect(serialize("test", "value")).toBe("test=value");
		});

		test("serializes cookie with all attributes", () => {
			const result = serialize("test", "value", {
				expires: new Date("Wed, 09 Jun 2021 10:18:14 GMT"),
				maxAge: 3600,
				domain: "example.com",
				path: "/",
				secure: true,
				httpOnly: true,
				sameSite: "none",
				partitioned: true,
				priority: "high",
			});

			expect(result).toStartWith("test=value;");
			expect(result).toContain("Expires=Wed, 09 Jun 2021 10:18:14 GMT");
			expect(result).toContain("Max-Age=3600");
			expect(result).toContain("Domain=example.com");
			expect(result).toContain("Path=/");
			expect(result).toContain("Secure");
			expect(result).toContain("HttpOnly");
			expect(result).toContain("Partitioned");
			expect(result).toContain("Priority=High");
			expect(result).toContain("SameSite=None");
		});

		test("handles empty value", () => {
			expect(serialize("test", "")).toBe("test=");
		});
	});

	describe("non-string values", () => {
		test("serializes numbers", () => {
			expect(serialize("counter", 42)).toBe("counter=42");
			expect(serialize("counter", 0)).toBe("counter=0");
			expect(serialize("offset", -1)).toBe("offset=-1");
		});

		test("serializes booleans", () => {
			expect(serialize("enabled", true)).toBe("enabled=true");
			expect(serialize("enabled", false)).toBe("enabled=false");
		});
	});

	describe("value encoding", () => {
		test("returns simple values unchanged", () => {
			expect(serialize("foo", "E=mc^2")).toBe("foo=E=mc^2");
		});

		test("encodes special characters", () => {
			expect(serialize("test", "value with spaces")).toBe(
				"test=value%20with%20spaces",
			);
			expect(serialize("test", 'value "with" quotes')).toBe(
				"test=value%20%22with%22%20quotes",
			);
			expect(serialize("test", "path\\to\\file")).toBe("test=path%5Cto%5Cfile");
		});

		test("encodes semicolons and percent signs to preserve round-trips", () => {
			expect(serialize("foo", "bar;with;semicolons")).toBe(
				"foo=bar%3Bwith%3Bsemicolons",
			);
			expect(serialize("foo", "100%25")).toBe("foo=100%2525");
		});

		test("round-trips encoded values through parse", () => {
			for (const value of ["bar;with;semicolons", "100%25"]) {
				expect(parse(serialize("foo", value)).foo).toBe(value);
			}
		});

		test("encodes non-ASCII and control characters", () => {
			expect(serialize("emoji", "🎉")).toBe("emoji=%F0%9F%8E%89");
			expect(serialize("test", "hello\nworld")).toBe("test=hello%0Aworld");
		});
	});

	describe("maxAge attribute", () => {
		test("accepts zero", () => {
			expect(serialize("test", "value", { maxAge: 0 })).toContain("Max-Age=0");
		});

		test("throws for negative max-age", () => {
			expect(() => serialize("test", "value", { maxAge: -1 })).toThrow(
				InvalidAttributeError,
			);
		});

		test("throws for non-integer max-age", () => {
			expect(() => serialize("test", "value", { maxAge: 1.5 })).toThrow(
				InvalidAttributeError,
			);
		});

		test("throws for non-finite max-age", () => {
			expect(() =>
				serialize("test", "value", { maxAge: Number.POSITIVE_INFINITY }),
			).toThrow(InvalidAttributeError);
		});
	});

	describe("sameSite attribute", () => {
		test("emits each valid value in canonical case", () => {
			expect(serialize("test", "value", { sameSite: "strict" })).toContain(
				"SameSite=Strict",
			);
			expect(serialize("test", "value", { sameSite: "lax" })).toContain(
				"SameSite=Lax",
			);
			const none = serialize("test", "value", {
				sameSite: "none",
				secure: true,
			});
			expect(none).toContain("SameSite=None");
			expect(none).toContain("Secure");
		});

		test("throws for SameSite=None without Secure", () => {
			expect(() => serialize("test", "value", { sameSite: "none" })).toThrow(
				InvalidAttributeError,
			);
		});

		test("throws for invalid sameSite value", () => {
			expect(() =>
				serialize("test", "value", { sameSite: "Invalid" as "strict" }),
			).toThrow("Invalid SameSite value");
		});

		test("throws for empty sameSite value", () => {
			expect(() =>
				serialize("test", "value", { sameSite: "" as "strict" }),
			).toThrow(InvalidAttributeError);
		});
	});

	describe("priority attribute", () => {
		test("emits each valid value in canonical case", () => {
			expect(serialize("test", "value", { priority: "low" })).toContain(
				"Priority=Low",
			);
			expect(serialize("test", "value", { priority: "medium" })).toContain(
				"Priority=Medium",
			);
			expect(serialize("test", "value", { priority: "high" })).toContain(
				"Priority=High",
			);
		});

		test("throws for invalid priority value", () => {
			expect(() =>
				serialize("test", "value", { priority: "invalid" as "low" }),
			).toThrow("Invalid priority value");
		});

		test("throws for empty priority value", () => {
			expect(() =>
				serialize("test", "value", { priority: "" as "low" }),
			).toThrow(InvalidAttributeError);
		});
	});

	describe("partitioned attribute", () => {
		test("emits Partitioned when Secure is set", () => {
			const result = serialize("test", "value", {
				partitioned: true,
				secure: true,
			});

			expect(result).toContain("Partitioned");
			expect(result).toContain("Secure");
		});

		test("omits Partitioned when false", () => {
			expect(serialize("test", "value", { partitioned: false })).toBe(
				"test=value",
			);
		});

		test("throws for Partitioned without Secure", () => {
			expect(() => serialize("test", "value", { partitioned: true })).toThrow(
				InvalidAttributeError,
			);
		});
	});

	describe("literal __Secure- / __Host- wire names", () => {
		test("serializes __Secure-<name> when Secure is set", () => {
			expect(serialize("__Secure-session", "abc123", { secure: true })).toBe(
				"__Secure-session=abc123; Secure",
			);
		});

		test("serializes __Host-<name> with the default Path=/", () => {
			expect(serialize("__Host-session", "abc123", { secure: true })).toBe(
				"__Host-session=abc123; Path=/; Secure",
			);
		});

		test("throws on __Secure-<name> without Secure", () => {
			expect(() => serialize("__Secure-session", "abc123")).toThrow(
				InvalidAttributeError,
			);
		});

		test("throws on __Host-<name> without Secure", () => {
			expect(() => serialize("__Host-session", "abc123")).toThrow(
				InvalidAttributeError,
			);
		});

		test("throws on __Host-<name> with Domain", () => {
			expect(() =>
				serialize("__Host-session", "abc123", {
					secure: true,
					domain: "example.com",
				}),
			).toThrow(InvalidAttributeError);
		});

		test("throws on __Host-<name> with a non-/ Path", () => {
			expect(() =>
				serialize("__Host-session", "abc123", {
					secure: true,
					path: "/admin",
				}),
			).toThrow(InvalidAttributeError);
		});

		test("throws on __Host-<name> with an empty Path", () => {
			expect(() =>
				serialize("__Host-session", "abc123", {
					secure: true,
					path: "",
				}),
			).toThrow(InvalidAttributeError);
		});
	});

	describe("error handling", () => {
		test("throws for missing name", () => {
			// @ts-expect-error
			expect(() => serialize()).toThrow(InvalidNameError);
			// @ts-expect-error
			expect(() => serialize()).toThrow("Name is required");
		});

		test("throws for invalid name", () => {
			expect(() => serialize("invalid name", "value")).toThrow(
				InvalidNameError,
			);
			expect(() => serialize("invalid name", "value")).toThrow("Invalid name");
			expect(() => serialize("café", "value")).toThrow(InvalidNameError);
		});

		test("throws for invalid date", () => {
			expect(() =>
				serialize("test", "value", { expires: new Date("invalid") }),
			).toThrow(InvalidDateError);
		});

		test("throws for malformed domain", () => {
			for (const domain of [
				"",
				"http://example.com",
				"-example.com",
				"example-.com",
				"example..com",
				"example.com\r\nX-Test: 1",
			]) {
				expect(() => serialize("test", "value", { domain })).toThrow(
					InvalidAttributeError,
				);
			}
		});

		test("throws for invalid path", () => {
			expect(() =>
				serialize("test", "value", { path: "/\r\nX-Test: 1" }),
			).toThrow(InvalidAttributeError);
			expect(() =>
				serialize("test", "value", { path: "/; Secure" }),
			).toThrow(InvalidAttributeError);
			expect(() =>
				serialize("test", "value", { path: "/café" }),
			).toThrow(InvalidAttributeError);
		});
	});
});
