import { describe, expect, test } from "bun:test";
import {
	Fami,
	FamiError,
	type InferCookieNames,
	InvalidNameError,
} from "../src";

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
		test("correctly infers cookie names", () => {
			const fami = new Fami(["session", "tracking"] as const);
			type Names = InferCookieNames<typeof fami>;

			// Type check - this should compile
			const validName: Names = "session";
			expect(validName).toBe("session");

			// Another valid name
			const anotherValidName: Names = "tracking";
			expect(anotherValidName).toBe("tracking");
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
