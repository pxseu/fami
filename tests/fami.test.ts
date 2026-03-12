import { describe, expect, test } from "bun:test";
import {
	Fami,
	FamiError,
	type InferCookieNames,
	InvalidNameError,
} from "../src";

/**
 * Helper that produces a compile error when `T` is not exactly `Expected`.
 * Usage: `const _: Expect<typeof value, "a" | "b"> = true;`
 */
type Expect<T, Expected> = [T] extends [Expected]
	? [Expected] extends [T]
		? true
		: false
	: false;

describe("Fami", () => {
	describe("constructor", () => {
		test("initializes with string cookie names", () => {
			const fami = new Fami(["session", "tracking"]);

			expect(fami.getNames()).toEqual(["session", "tracking"]);
		});

		test("initializes with cookie definitions", () => {
			const fami = new Fami([
				{
					name: "session",
					httpOnly: true,
					secure: true,
					sameSite: "strict",
				},
			]);

			expect(fami.getNames()).toEqual(["session"]);
			expect(fami.getDefinition("session")).toEqual({
				httpOnly: true,
				secure: true,
				sameSite: "strict",
			});
		});

		test("initializes with object-based cookie definitions", () => {
			const fami = new Fami({
				tracker: {},
				session: { httpOnly: true, secure: true, sameSite: "strict" },
			});

			expect(fami.getNames()).toContain("tracker");
			expect(fami.getNames()).toContain("session");
			expect(fami.getDefinition("tracker")).toEqual({});
			expect(fami.getDefinition("session")).toEqual({
				httpOnly: true,
				secure: true,
				sameSite: "strict",
			});
		});

		test("initializes with mixed cookie definitions", () => {
			const fami = new Fami([
				"tracking",
				{
					name: "session",
					httpOnly: true,
					secure: true,
				},
			]);

			expect(fami.getNames()).toEqual(["tracking", "session"]);
		});

		test("throws error for duplicate cookie names", () => {
			expect(() => new Fami(["session", "session"])).toThrow(FamiError);
			expect(() => new Fami(["session", "session"])).toThrow(
				"Cookie name session is already registered",
			);
		});

		test("throws error for invalid cookie names", () => {
			expect(() => new Fami(["invalid name"])).toThrow(InvalidNameError);
		});

		test("throws error for invalid cookie name in definitions", () => {
			expect(
				() => new Fami([{ name: "invalid name", httpOnly: true }]),
			).toThrow(InvalidNameError);
		});

		test("object-based constructor throws error for invalid cookie names", () => {
			expect(() => new Fami({ "invalid name": {} })).toThrow(InvalidNameError);
		});

		test("object-based constructor validates domain", () => {
			expect(
				() => new Fami({ session: { domain: "bad domain value" } }),
			).toThrow();
		});

		test("object-based constructor validates path", () => {
			expect(() => new Fami({ session: { path: "bad\x00path" } })).toThrow();
		});
	});

	describe("object-based constructor usage", () => {
		test("serialize works with object-based constructor", () => {
			const fami = new Fami({
				session: { httpOnly: true, secure: true, sameSite: "strict" },
			});

			const result = fami.serialize("session", "abc123");

			expect(result).toContain("session=abc123");
			expect(result).toContain("HttpOnly");
			expect(result).toContain("Secure");
			expect(result).toContain("SameSite=Strict");
		});

		test("parse works with object-based constructor", () => {
			const fami = new Fami({
				session: { httpOnly: true },
				tracking: {},
			});

			const result = fami.parse("session=abc123; tracking=xyz789");

			expect(result).toEqual({
				session: "abc123",
				tracking: "xyz789",
			});
		});

		test("delete works with object-based constructor", () => {
			const fami = new Fami({
				session: { path: "/", domain: "example.com" },
			});

			const result = fami.delete("session");

			expect(result).toContain("session=");
			expect(result).toContain("Max-Age=0");
			expect(result).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
			expect(result).toContain("Path=/");
			expect(result).toContain("Domain=example.com");
		});

		test("serializeAll works with object-based constructor", () => {
			const fami = new Fami({
				session: { httpOnly: true },
				tracking: {},
			});

			const result = fami.serializeAll({
				session: "abc123",
				tracking: "xyz789",
			});

			expect(result[0]).toContain("session=abc123");
			expect(result[0]).toContain("HttpOnly");
			expect(result[1]).toBe("tracking=xyz789");
		});

		test("has works with object-based constructor", () => {
			const fami = new Fami({
				session: {},
			});

			expect(fami.has("session")).toBe(true);
			expect(fami.has("unregistered")).toBe(false);
		});

		test("getDefinition works with object-based constructor", () => {
			const fami = new Fami({
				session: { httpOnly: true, secure: true },
			});

			expect(fami.getDefinition("session")).toEqual({
				httpOnly: true,
				secure: true,
			});
		});

		test("cookies getter works with object-based constructor", () => {
			const fami = new Fami({
				tracking: {},
				session: { httpOnly: true },
			});

			const cookies = fami.cookies;

			expect(cookies).toEqual({
				tracking: {},
				session: { httpOnly: true },
			});
		});

		test("expires function works with object-based constructor", () => {
			const expiresDate = new Date("2025-12-31T00:00:00Z");
			const fami = new Fami({
				session: { expires: () => expiresDate },
			});

			const result = fami.serialize("session", "abc123");

			expect(result).toContain("Expires=Wed, 31 Dec 2025 00:00:00 GMT");
		});

		test("description field works with object-based constructor", () => {
			const fami = new Fami({
				session: {
					description: "User session cookie",
					httpOnly: true,
				},
			});

			expect(fami.getDefinition("session")?.description).toBe(
				"User session cookie",
			);
		});
	});

	describe("serialize", () => {
		test("serializes cookie with default attributes", () => {
			const fami = new Fami([
				{
					name: "session",
					httpOnly: true,
					secure: true,
					sameSite: "strict",
				},
			]);

			const result = fami.serialize("session", "abc123");

			expect(result).toContain("session=abc123");
			expect(result).toContain("HttpOnly");
			expect(result).toContain("Secure");
			expect(result).toContain("SameSite=Strict");
		});

		test("overrides default attributes with provided attributes", () => {
			const fami = new Fami([
				{
					name: "session",
					sameSite: "strict",
				},
			]);

			const result = fami.serialize("session", "abc123", {
				sameSite: "lax",
			});

			expect(result).toContain("session=abc123");
			expect(result).toContain("SameSite=Lax");
			expect(result).not.toContain("SameSite=Strict");
		});

		test("uses expires function from definition", () => {
			const expiresDate = new Date("2025-12-31T00:00:00Z");
			const fami = new Fami([
				{
					name: "session",
					expires: () => expiresDate,
				},
			]);

			const result = fami.serialize("session", "abc123");

			expect(result).toContain("session=abc123");
			expect(result).toContain("Expires=Wed, 31 Dec 2025 00:00:00 GMT");
		});

		test("overrides expires function with provided expires", () => {
			const overrideDate = new Date("2026-01-01T00:00:00Z");

			const fami = new Fami([
				{
					name: "session",
					expires: () =>
						expect.unreachable("expires function should not be called"),
				},
			]);

			const result = fami.serialize("session", "abc123", {
				expires: overrideDate,
			});

			expect(result).toContain("Expires=Thu, 01 Jan 2026 00:00:00 GMT");
		});

		test("serializes cookie without default attributes", () => {
			const fami = new Fami(["tracking"]);

			const result = fami.serialize("tracking", "value123");

			expect(result).toBe("tracking=value123");
		});

		test("serializes with custom attributes", () => {
			const fami = new Fami(["tracking"]);

			const result = fami.serialize("tracking", "value", {
				path: "/",
				maxAge: 3600,
			});

			expect(result).toContain("tracking=value");
			expect(result).toContain("Max-Age=3600");
			expect(result).toContain("Path=/");
		});
	});

	describe("serializeAll", () => {
		test("serializes all cookies in the record", () => {
			const fami = new Fami(["session", "tracking"]);

			const result = fami.serializeAll({
				session: "abc123",
				tracking: {
					value: "value",
				},
			});

			expect(result).toEqual(["session=abc123", "tracking=value"]);
		});

		test("serializes all cookies in the record with mixed values and attributes", () => {
			const fami = new Fami(["session", "tracking"]);

			const [session, tracking] = fami.serializeAll({
				session: "abc123",
				tracking: { value: "value", path: "/", maxAge: 3600 },
			});

			expect(session).toEqual("session=abc123");
			expect(tracking).toContain("tracking=value");
			expect(tracking).toContain("Path=/");
			expect(tracking).toContain("Max-Age=3600");
		});

		test("serializes all cookies in the record with attributes", () => {
			const fami = new Fami([
				"session",
				{
					name: "tracking",
					path: "/",
					maxAge: 3600,
				},
			]);

			const [session, tracking] = fami.serializeAll({
				session: "abc123",
				tracking: "value",
			});

			expect(session).toEqual("session=abc123");
			expect(tracking).toContain("tracking=value");
			expect(tracking).toContain("Path=/");
			expect(tracking).toContain("Max-Age=3600");
		});

		test("correctly overrides attributes", () => {
			const fami = new Fami([
				{
					name: "tracking",
					path: "/admin",
					maxAge: 3600,
				},
			]);

			const [tracking] = fami.serializeAll({
				tracking: { value: "value", path: "/docs", maxAge: 0 },
			});

			expect(tracking).toContain("tracking=value");
			expect(tracking).toContain("Path=/docs");
			expect(tracking).toContain("Max-Age=0");
			expect(tracking).not.toContain("Path=/admin");
			expect(tracking).not.toContain("Max-Age=3600");
		});

		test("serializes all cookies in the record with undefined values", () => {
			const fami = new Fami(["session", "tracking"]);

			const result = fami.serializeAll({
				session: "abc123",
				tracking: undefined,
			});

			expect(result).toEqual(["session=abc123"]);
		});

		test("returns empty array for no cookies", () => {
			const fami = new Fami(["session", "tracking"]);

			const result = fami.serializeAll({});

			expect(result).toEqual([]);
		});

		test("can serialize with an empty string", () => {
			const fami = new Fami(["session"]);

			const result = fami.serializeAll({
				session: "",
			});

			expect(result).toEqual(["session="]);
		});
	});

	describe("parse", () => {
		test("parses cookie header and returns registered cookies", () => {
			const fami = new Fami(["session", "tracking"]);

			const result = fami.parse("session=abc123; tracking=xyz789");

			expect(result).toEqual({
				session: "abc123",
				tracking: "xyz789",
			});
		});

		test("returns undefined for missing cookies", () => {
			const fami = new Fami(["session", "tracking"]);

			const result = fami.parse("session=abc123");

			expect(result).toEqual({
				session: "abc123",
				tracking: undefined,
			});
		});

		test("ignores unregistered cookies", () => {
			const fami = new Fami(["session"]);

			const result = fami.parse("session=abc123; unregistered=value");

			expect(result).toEqual({
				session: "abc123",
			});
			expect("unregistered" in result).toBe(false);
		});

		test("handles empty cookie header", () => {
			const fami = new Fami(["session", "tracking"]);

			const result = fami.parse("");

			expect(result).toEqual({
				session: undefined,
				tracking: undefined,
			});
		});
	});

	describe("delete", () => {
		test("creates a deletion header", () => {
			const fami = new Fami(["session"]);

			const result = fami.delete("session");

			expect(result).toContain("session=");
			expect(result).toContain("Max-Age=0");
			expect(result).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
		});

		test("includes default attributes in deletion header", () => {
			const fami = new Fami([
				{
					name: "session",
					path: "/",
					domain: "example.com",
				},
			]);

			const result = fami.delete("session");

			expect(result).toContain("Path=/");
			expect(result).toContain("Domain=example.com");
		});
	});

	describe("getDefinition", () => {
		test("returns cookie definition", () => {
			const fami = new Fami([
				{
					name: "session",
					httpOnly: true,
					secure: true,
				},
			]);

			const definition = fami.getDefinition("session");

			expect(definition).toEqual({
				httpOnly: true,
				secure: true,
			});
		});

		test("returns undefined for unregistered cookie", () => {
			const fami = new Fami(["session"]);

			// @ts-expect-error - testing runtime behavior
			const definition = fami.getDefinition("unregistered");

			expect(definition).toBeUndefined();
		});
	});

	describe("has", () => {
		test("returns true for registered cookie", () => {
			const fami = new Fami(["session"]);

			expect(fami.has("session")).toBe(true);
		});

		test("returns false for unregistered cookie", () => {
			const fami = new Fami(["session"]);

			expect(fami.has("unregistered")).toBe(false);
		});
	});

	describe("getNames", () => {
		test("returns all registered cookie names", () => {
			const fami = new Fami(["session", "tracking", "preferences"]);

			const names = fami.getNames();

			expect(names).toEqual(["session", "tracking", "preferences"]);
		});

		test("returns empty array for no cookies", () => {
			const fami = new Fami([]);

			const names = fami.getNames();

			expect(names).toEqual([]);
		});
	});

	describe("cookies getter", () => {
		test("returns all cookie definitions", () => {
			const fami = new Fami([
				"tracking",
				{
					name: "session",
					httpOnly: true,
				},
			]);

			const cookies = fami.cookies;

			expect(cookies).toEqual({
				tracking: {},
				session: {
					httpOnly: true,
				},
			});
		});
	});

	describe("InferCookieNames type", () => {
		test("correctly infers cookie names from array", () => {
			const fami = new Fami(["session", "tracking"] as const);
			type Names = InferCookieNames<typeof fami>;

			// Type check - this should compile
			const validName: Names = "session";
			expect(validName).toBe("session");

			// Another valid name
			const anotherValidName: Names = "tracking";
			expect(anotherValidName).toBe("tracking");

			const _: Expect<Names, "session" | "tracking"> = true;
			expect(_).toBe(true);
		});

		test("correctly infers cookie names from object", () => {
			const fami = new Fami({
				session: { httpOnly: true },
				tracking: {},
			});
			type Names = InferCookieNames<typeof fami>;

			const validName: Names = "session";
			expect(validName).toBe("session");

			const anotherValidName: Names = "tracking";
			expect(anotherValidName).toBe("tracking");

			const _: Expect<Names, "session" | "tracking"> = true;
			expect(_).toBe(true);
		});

		test("object-based and array-based infer the same names", () => {
			const fromArray = new Fami([
				"session",
				{ name: "tracking", httpOnly: true },
			] as const);

			const fromObject = new Fami({
				session: {},
				tracking: { httpOnly: true },
			});

			type ArrayNames = InferCookieNames<typeof fromArray>;
			type ObjectNames = InferCookieNames<typeof fromObject>;

			// Both should infer "session" | "tracking"
			const _arrayCheck: Expect<ArrayNames, "session" | "tracking"> = true;
			const _objectCheck: Expect<ObjectNames, "session" | "tracking"> = true;
			const _equivalent: Expect<ArrayNames, ObjectNames> = true;

			expect(_arrayCheck).toBe(true);
			expect(_objectCheck).toBe(true);
			expect(_equivalent).toBe(true);
		});

		test("object-based constructor infers names for serialize/parse/delete", () => {
			const fami = new Fami({
				auth: { httpOnly: true, secure: true },
				theme: {},
			});

			// These should all compile — the names are properly inferred
			const serialized = fami.serialize("auth", "token");
			expect(serialized).toContain("auth=token");

			const parsed = fami.parse("auth=token; theme=dark");
			expect(parsed.auth).toBe("token");
			expect(parsed.theme).toBe("dark");

			const deleted = fami.delete("theme");
			expect(deleted).toContain("theme=");

			// Verify the parsed type has the right keys
			type ParsedKeys = keyof typeof parsed;
			const _: Expect<ParsedKeys, "auth" | "theme"> = true;
			expect(_).toBe(true);
		});
	});

	describe("description field", () => {
		test("allows description field in cookie definition", () => {
			const fami = new Fami([
				{
					name: "session",
					description: "User session cookie",
					httpOnly: true,
				},
			]);

			const definition = fami.getDefinition("session");

			expect(definition?.description).toBe("User session cookie");
		});
	});

	describe("prototype pollution protection", () => {
		test("allows __proto__ as cookie name in constructor", () => {
			const fami = new Fami(["__proto__", "session"]);

			expect(fami.getNames()).toContain("__proto__");
			expect(fami.getNames()).toContain("session");
			expect(fami.has("__proto__")).toBe(true);
		});

		test("allows constructor as cookie name in constructor", () => {
			const fami = new Fami(["constructor", "session"]);

			expect(fami.getNames()).toContain("constructor");
			expect(fami.getNames()).toContain("session");
			expect(fami.has("constructor")).toBe(true);
		});

		test("parses __proto__ cookie correctly", () => {
			const fami = new Fami(["__proto__", "session"]);
			const result = fami.parse("__proto__=polluted; session=abc123");

			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			expect(result.__proto__).toBe("polluted");
			expect(result.session).toBe("abc123");
		});

		test("parses constructor cookie correctly", () => {
			const fami = new Fami(["constructor", "session"]);
			const result = fami.parse("constructor=evil; session=abc123");

			expect(Object.hasOwn(result, "constructor")).toBe(true);
			expect(result.constructor).toBe("evil");
			expect(result.session).toBe("abc123");
		});

		test("serializes __proto__ cookie correctly", () => {
			const fami = new Fami(["__proto__"]);
			const result = fami.serialize("__proto__", "value");

			expect(result).toBe("__proto__=value");
		});

		test("serializes constructor cookie correctly", () => {
			const fami = new Fami(["constructor"]);
			const result = fami.serialize("constructor", "value");

			expect(result).toBe("constructor=value");
		});

		test("does not pollute Object.prototype", () => {
			const fami = new Fami(["__proto__", "constructor"]);
			fami.parse("__proto__=polluted; constructor=evil");

			expect(({} as Record<string, unknown>).polluted).toBeUndefined();
			expect(Object.keys(Object.prototype)).toEqual([]);
		});
	});

	describe("real-world usage", () => {
		test("manages authentication cookies", () => {
			const cookies = new Fami([
				{
					name: "access_token",
					httpOnly: true,
					secure: true,
					sameSite: "strict",
					expires: () => new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
				},
				{
					name: "refresh_token",
					httpOnly: true,
					secure: true,
					sameSite: "strict",
					path: "/",
					expires: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
				},
			]);

			// Serialize tokens
			const accessHeader = cookies.serialize("access_token", "jwt_token_here");
			const refreshHeader = cookies.serialize(
				"refresh_token",
				"refresh_jwt_here",
			);

			expect(accessHeader).toContain("HttpOnly");
			expect(accessHeader).toContain("Secure");
			expect(accessHeader).toContain("SameSite=Strict");

			expect(refreshHeader).toContain("Path=/");

			// Parse incoming cookies
			const parsed = cookies.parse(
				"access_token=jwt_token_here; refresh_token=refresh_jwt_here",
			);

			expect(parsed.access_token).toBe("jwt_token_here");
			expect(parsed.refresh_token).toBe("refresh_jwt_here");

			// Delete tokens
			const deleteAccess = cookies.delete("access_token");
			expect(deleteAccess).toContain("Max-Age=0");
		});
	});
});
