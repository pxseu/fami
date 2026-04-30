import { describe, expect, test } from "bun:test";
import { Fami, type InferCookieNames, InvalidNameError } from "../src";

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
		describe("registration", () => {
			test("initializes with empty definitions", () => {
				const fami = new Fami({ session: {}, tracking: {} });

				expect(fami.getNames()).toEqual(["session", "tracking"]);
			});

			test("initializes with cookie definitions", () => {
				const fami = new Fami({
					session: {
						httpOnly: true,
						secure: true,
						sameSite: "strict",
					},
				});

				expect(fami.getNames()).toEqual(["session"]);
				expect(fami.getDefinition("session")).toEqual({
					httpOnly: true,
					secure: true,
					sameSite: "strict",
				});
			});

			test("initializes with mixed cookie definitions", () => {
				const fami = new Fami({
					tracking: {},
					session: {
						httpOnly: true,
						secure: true,
					},
				});

				expect(fami.getNames()).toEqual(["tracking", "session"]);
			});
		});

		describe("input validation", () => {
			test("throws error for invalid cookie names", () => {
				expect(() => new Fami({ "invalid name": {} })).toThrow(
					InvalidNameError,
				);
			});

			test("throws error for invalid cookie name in definitions", () => {
				expect(() => new Fami({ "invalid name": { httpOnly: true } })).toThrow(
					InvalidNameError,
				);
			});

			test("validates domain values", () => {
				expect(
					() => new Fami({ session: { domain: "bad domain value" } }),
				).toThrow();
			});

			test("validates path values", () => {
				expect(() => new Fami({ session: { path: "bad\x00path" } })).toThrow();
			});

			test("validates priority values", () => {
				expect(
					() =>
						new Fami({
							session: { priority: "critical" as "low" },
						}),
				).toThrow();
			});

			test("validates sameSite values", () => {
				expect(
					() =>
						new Fami({
							session: { sameSite: "invalid" as "strict" },
						}),
				).toThrow();
			});
		});
	});

	describe("serialize", () => {
		test("serializes cookie with default attributes", () => {
			const fami = new Fami({
				session: {
					httpOnly: true,
					secure: true,
					sameSite: "strict",
				},
			});

			const result = fami.serialize("session", "abc123");

			expect(result).toStartWith("session=abc123;");
			expect(result).toContain("HttpOnly");
			expect(result).toContain("Secure");
			expect(result).toContain("SameSite=Strict");
		});

		test("overrides default attributes with provided attributes", () => {
			const fami = new Fami({
				session: {
					sameSite: "strict",
				},
			});

			const result = fami.serialize("session", "abc123", {
				sameSite: "lax",
			});

			expect(result).toStartWith("session=abc123;");
			expect(result).toContain("SameSite=Lax");
			expect(result).not.toContain("SameSite=Strict");
		});

		test("uses expires function from definition", () => {
			const expiresDate = new Date("2025-12-31T00:00:00Z");
			const fami = new Fami({
				session: {
					expires: () => expiresDate,
				},
			});

			const result = fami.serialize("session", "abc123");

			expect(result).toStartWith("session=abc123;");
			expect(result).toContain("Expires=Wed, 31 Dec 2025 00:00:00 GMT");
		});

		test("overrides expires function with provided expires", () => {
			const overrideDate = new Date("2026-01-01T00:00:00Z");

			const fami = new Fami({
				session: {
					expires: () =>
						expect.unreachable("expires function should not be called"),
				},
			});

			const result = fami.serialize("session", "abc123", {
				expires: overrideDate,
			});

			expect(result).toStartWith("session=abc123;");
			expect(result).toContain("Expires=Thu, 01 Jan 2026 00:00:00 GMT");
		});

		test("serializes cookie without default attributes", () => {
			const fami = new Fami({ tracking: {} });

			const result = fami.serialize("tracking", "value123");

			expect(result).toBe("tracking=value123");
		});

		test("serializes with custom attributes", () => {
			const fami = new Fami({ tracking: {} });

			const result = fami.serialize("tracking", "value", {
				path: "/",
				maxAge: 3600,
			});

			expect(result).toStartWith("tracking=value;");
			expect(result).toContain("Max-Age=3600");
			expect(result).toContain("Path=/");
		});
	});

	describe("parse", () => {
		test("parses cookie header and returns registered cookies", () => {
			const fami = new Fami({ session: {}, tracking: {} });

			const result = fami.parse("session=abc123; tracking=xyz789");

			expect(result).toEqual({
				session: "abc123",
				tracking: "xyz789",
			});
		});

		test("returns undefined for missing cookies", () => {
			const fami = new Fami({ session: {}, tracking: {} });

			const result = fami.parse("session=abc123");

			expect(result).toEqual({
				session: "abc123",
				tracking: undefined,
			});
		});

		test("ignores unregistered cookies", () => {
			const fami = new Fami({ session: {} });

			const result = fami.parse("session=abc123; unregistered=value");

			expect(result).toEqual({
				session: "abc123",
			});
			expect("unregistered" in result).toBe(false);
		});

		test("handles empty cookie header", () => {
			const fami = new Fami({ session: {}, tracking: {} });

			const result = fami.parse("");

			expect(result).toEqual({
				session: undefined,
				tracking: undefined,
			});
		});
	});

	describe("delete", () => {
		test("creates a deletion header", () => {
			const fami = new Fami({ session: {} });

			const result = fami.delete("session");

			expect(result).toStartWith("session=;");
			expect(result).toContain("Max-Age=0");
			expect(result).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
		});

		test("includes default attributes in deletion header", () => {
			const fami = new Fami({
				session: {
					path: "/",
					domain: "example.com",
				},
			});

			const result = fami.delete("session");

			expect(result).toStartWith("session=;");
			expect(result).toContain("Path=/");
			expect(result).toContain("Domain=example.com");
		});
	});

	describe("getDefinition", () => {
		test("returns cookie definition", () => {
			const fami = new Fami({
				session: {
					httpOnly: true,
					secure: true,
				},
			});

			const definition = fami.getDefinition("session");

			expect(definition).toEqual({
				httpOnly: true,
				secure: true,
			});
		});

		test("returns undefined for unregistered cookie", () => {
			const fami = new Fami({ session: {} });

			// @ts-expect-error - testing runtime behavior
			const definition = fami.getDefinition("unregistered");

			expect(definition).toBeUndefined();
		});
	});

	describe("has", () => {
		test("returns true for registered cookie", () => {
			const fami = new Fami({ session: {} });

			expect(fami.has("session")).toBe(true);
		});

		test("returns false for unregistered cookie", () => {
			const fami = new Fami({ session: {} });

			expect(fami.has("unregistered")).toBe(false);
		});
	});

	describe("getNames", () => {
		test("returns all registered cookie names", () => {
			const fami = new Fami({ session: {}, tracking: {}, preferences: {} });

			const names = fami.getNames();

			expect(names).toEqual(["session", "tracking", "preferences"]);
		});

		test("returns empty array for no cookies", () => {
			const fami = new Fami({});

			const names = fami.getNames();

			expect(names).toEqual([]);
		});
	});

	describe("cookies getter", () => {
		test("returns all cookie definitions", () => {
			const fami = new Fami({
				tracking: {},
				session: {
					httpOnly: true,
				},
			});

			const cookies = fami.cookies;

			expect(cookies).toEqual({
				tracking: {},
				session: {
					httpOnly: true,
				},
			});
		});

		test("returns an immutable definitions object", () => {
			const fami = new Fami({ session: {} });

			expect(Object.isFrozen(fami.cookies)).toBe(true);
			expect(Object.isFrozen(fami.cookies.session)).toBe(true);
			expect(() => {
				(fami.cookies as Record<string, unknown>).session = { secure: true };
			}).toThrow();
			expect(() => {
				(fami.cookies.session as { path?: string }).path = "/";
			}).toThrow();
		});

		test("copies definitions so input mutations do not change defaults", () => {
			const definitions = {
				session: {
					path: "/",
					httpOnly: true,
				},
			};
			const fami = new Fami(definitions);

			definitions.session.path = "/changed";

			expect(fami.serialize("session", "value")).toBe(
				"session=value; Path=/; HttpOnly",
			);
		});
	});

	describe("signed cookie behavior", () => {
		test("serialize returns a promise for signed cookies", async () => {
			const fami = new Fami({
				session: {
					httpOnly: true,
					secure: true,
					sameSite: "strict",
					secret: "super-secret",
				},
				tracking: {},
			});

			const session = fami.serialize("session", "abc123");
			const tracking = fami.serialize("tracking", "value");

			expect(session).toBeInstanceOf(Promise);
			expect(tracking).not.toBeInstanceOf(Promise);

			const s_header = await session;
			const t_header = tracking;

			expect(s_header).toStartWith("session=abc123.");
			expect(s_header).toContain("; HttpOnly");
			expect(s_header).toContain("Secure");
			expect(s_header).toContain("SameSite=Strict");

			expect(t_header).toEqual("tracking=value");
		});

		test("delete returns a promise for signed cookies", async () => {
			const fami = new Fami({
				session: {
					httpOnly: true,
					secure: true,
					sameSite: "strict",
					secret: "super-secret",
				},
				tracking: {},
			});

			const session = fami.delete("session");
			const tracking = fami.delete("tracking");

			expect(session).toBeInstanceOf(Promise);
			expect(tracking).not.toBeInstanceOf(Promise);

			const s_header = await session;
			const t_header = tracking;

			expect(s_header).toStartWith("session=;");
			expect(s_header).toContain("Max-Age=0");
			expect(t_header).toStartWith("tracking=;");
			expect(t_header).toContain("Max-Age=0");
		});

		test("parse returns a promise for signed cookies", async () => {
			const fami = new Fami({
				session: {
					httpOnly: true,
					secure: true,
					sameSite: "strict",
					secret: "super-secret",
				},
				tracking: {},
			});

			const cookies = fami.parse(
				"session=abc123.BQMG5r8LnjayZExNmMxnQ0rkwWy0_TTsAoqCu84uX7A; tracking=xyz789",
			);

			expect(cookies.session).toBeInstanceOf(Promise);
			expect(cookies.tracking).not.toBeInstanceOf(Promise);

			const session = await cookies.session;
			const tracking = cookies.tracking;

			expect(session).toBe("abc123");
			expect(tracking).toBe("xyz789");
		});

		test("parse returns false for tampered signed cookies", async () => {
			const fami = new Fami({
				session: {
					httpOnly: true,
					secure: true,
					sameSite: "strict",
					secret: "super-secret",
				},
			});

			const cookies = fami.parse(
				"session=abc123.BQMG5r8LnjayZExNmmxnQ0rkwWy0_TTsAoqCu84uX7A",
			);

			expect(cookies.session).toBeInstanceOf(Promise);

			const result = await cookies.session;

			expect(result).toBe(undefined);
		});
	});

	describe("InferCookieNames type", () => {
		test("correctly infers cookie names from object", () => {
			const fami = new Fami({
				session: {},
				tracking: {},
			} as const);
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

		test("correctly infers cookie names from object with attributes", () => {
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

		test("infers stable names from const definitions", () => {
			const fromObject = new Fami({
				session: {},
				tracking: { httpOnly: true },
			} as const);

			const fromObjectWithDefaults = new Fami({
				session: {},
				tracking: { httpOnly: true },
			} as const);

			type ObjectNames = InferCookieNames<typeof fromObject>;
			type ObjectNamesWithDefaults = InferCookieNames<
				typeof fromObjectWithDefaults
			>;

			const _objectCheck: Expect<ObjectNames, "session" | "tracking"> = true;
			const _defaultsCheck: Expect<
				ObjectNamesWithDefaults,
				"session" | "tracking"
			> = true;
			const _equivalent: Expect<ObjectNames, ObjectNamesWithDefaults> = true;

			expect(_objectCheck).toBe(true);
			expect(_defaultsCheck).toBe(true);
			expect(_equivalent).toBe(true);
		});

		test("infers names for serialize, parse, and delete", () => {
			const fami = new Fami({
				auth: { httpOnly: true, secure: true },
				theme: {},
			});

			// These should all compile — the names are properly inferred
			const serialized = fami.serialize("auth", "token");
			expect(serialized).toStartWith("auth=token;");

			const parsed = fami.parse("auth=token; theme=dark");
			expect(parsed.auth).toBe("token");
			expect(parsed.theme).toBe("dark");

			const deleted = fami.delete("theme");
			expect(deleted).toStartWith("theme=;");
			expect(deleted).toContain("Max-Age=0");

			// Verify the parsed type has the right keys
			type ParsedKeys = keyof typeof parsed;
			const _: Expect<ParsedKeys, "auth" | "theme"> = true;
			expect(_).toBe(true);
		});
	});

	describe("description field", () => {
		test("allows description field in cookie definition", () => {
			const fami = new Fami({
				session: {
					description: "User session cookie",
					httpOnly: true,
				},
			});

			const definition = fami.getDefinition("session");

			expect(definition?.description).toBe("User session cookie");
		});
	});

	describe("prototype pollution protection", () => {
		test("allows __proto__ as cookie name in constructor", () => {
			const fami = new Fami({ ["__proto__"]: {}, session: {} });

			expect(fami.getNames()).toContain("__proto__");
			expect(fami.getNames()).toContain("session");
			expect(fami.has("__proto__")).toBe(true);
		});

		test("allows constructor as cookie name in constructor", () => {
			const fami = new Fami({ constructor: {}, session: {} });

			expect(fami.getNames()).toContain("constructor");
			expect(fami.getNames()).toContain("session");
			expect(fami.has("constructor")).toBe(true);
		});

		test("parses __proto__ cookie correctly", () => {
			const fami = new Fami({ ["__proto__"]: {}, session: {} });
			const result = fami.parse("__proto__=polluted; session=abc123");

			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			expect(result.__proto__).toBe("polluted");
			expect(result.session).toBe("abc123");
		});

		test("parses constructor cookie correctly", () => {
			const fami = new Fami({ constructor: {}, session: {} });
			const result = fami.parse("constructor=evil; session=abc123");

			expect(Object.hasOwn(result, "constructor")).toBe(true);
			expect(result.constructor).toBe("evil");
			expect(result.session).toBe("abc123");
		});

		test("serializes __proto__ cookie correctly", () => {
			const fami = new Fami({ ["__proto__"]: {} });
			const result = fami.serialize("__proto__", "value");

			expect(result).toBe("__proto__=value");
		});

		test("serializes constructor cookie correctly", () => {
			const fami = new Fami({ constructor: {} });
			const result = fami.serialize("constructor", "value");

			expect(result).toBe("constructor=value");
		});

		test("does not pollute Object.prototype", () => {
			const fami = new Fami({ ["__proto__"]: {}, constructor: {} });
			fami.parse("__proto__=polluted; constructor=evil");

			expect(({} as Record<string, unknown>).polluted).toBeUndefined();
			expect(Object.keys(Object.prototype)).toEqual([]);
		});
	});

	describe("real-world usage", () => {
		test("manages authentication cookies", () => {
			const cookies = new Fami({
				access_token: {
					httpOnly: true,
					secure: true,
					sameSite: "strict",
					expires: () => new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
				},
				refresh_token: {
					httpOnly: true,
					secure: true,
					sameSite: "strict",
					path: "/",
					expires: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
				},
			});

			// Serialize tokens
			const accessHeader = cookies.serialize("access_token", "jwt_token_here");
			const refreshHeader = cookies.serialize(
				"refresh_token",
				"refresh_jwt_here",
			);

			expect(accessHeader).toStartWith("access_token=jwt_token_here;");
			expect(accessHeader).toContain("HttpOnly");
			expect(accessHeader).toContain("Secure");
			expect(accessHeader).toContain("SameSite=Strict");

			expect(refreshHeader).toStartWith("refresh_token=refresh_jwt_here;");
			expect(refreshHeader).toContain("Path=/");

			// Parse incoming cookies
			const parsed = cookies.parse(
				"access_token=jwt_token_here; refresh_token=refresh_jwt_here",
			);

			expect(parsed.access_token).toBe("jwt_token_here");
			expect(parsed.refresh_token).toBe("refresh_jwt_here");

			// Delete tokens
			const deleteAccess = cookies.delete("access_token");
			expect(deleteAccess).toStartWith("access_token=;");
			expect(deleteAccess).toContain("Max-Age=0");
		});
	});
});
