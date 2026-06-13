import { describe, expect, spyOn, test } from "bun:test";
import {
	Fami,
	type InferCookieNames,
	InvalidAttributeError,
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
				session: { httpOnly: true, secure: true },
			});

			expect(fami.getNames()).toEqual(["tracking", "session"]);
		});

		test("rejects invalid cookie names", () => {
			expect(() => new Fami({ "invalid name": {} })).toThrow(InvalidNameError);
			expect(() => new Fami({ "invalid name": { httpOnly: true } })).toThrow(
				InvalidNameError,
			);
			expect(() => new Fami({ café: {} })).toThrow(InvalidNameError);
		});

		test("rejects invalid attribute values", () => {
			expect(() => new Fami({ session: { domain: "bad domain" } })).toThrow(
				InvalidAttributeError,
			);
			expect(() => new Fami({ session: { path: "bad\x00path" } })).toThrow(
				InvalidAttributeError,
			);
			expect(() => new Fami({ session: { domain: "" } })).toThrow(
				InvalidAttributeError,
			);
			expect(() => new Fami({ session: { path: "" } })).toThrow(
				InvalidAttributeError,
			);
			expect(
				() => new Fami({ session: { priority: "critical" as "low" } }),
			).toThrow(InvalidAttributeError);
			expect(
				() => new Fami({ session: { priority: "" as "low" } }),
			).toThrow(InvalidAttributeError);
			expect(
				() => new Fami({ session: { sameSite: "invalid" as "strict" } }),
			).toThrow(InvalidAttributeError);
			expect(
				() => new Fami({ session: { sameSite: "" as "strict" } }),
			).toThrow(InvalidAttributeError);
		});

		test("rejects misconfigured defaults", () => {
			expect(() => new Fami({ session: { sameSite: "none" } })).toThrow(
				InvalidAttributeError,
			);
			expect(() => new Fami({ session: { partitioned: true } })).toThrow(
				InvalidAttributeError,
			);
			expect(
				() => new Fami({ session: { prefix: "origin" as "host" } }),
			).toThrow(InvalidAttributeError);
			expect(
				() => new Fami({ session: { prefix: "host", path: "/admin" } }),
			).toThrow(InvalidAttributeError);
			expect(
				() => new Fami({ session: { prefix: "host", path: "" } }),
			).toThrow(InvalidAttributeError);
			expect(
				() => new Fami({ session: { prefix: "host", domain: "example.com" } }),
			).toThrow(InvalidAttributeError);
		});

		test("rejects empty signing secrets", () => {
			expect(() => new Fami({ session: { secret: "" } })).toThrow(
				InvalidAttributeError,
			);
		});

		test("rejects non-string signing secrets", () => {
			expect(
				() =>
					new Fami({
						session: { secret: 0 as unknown as string },
					}),
			).toThrow(InvalidAttributeError);
		});

		test("accepts valid prefix defaults", () => {
			expect(() => new Fami({ session: { prefix: "secure" } })).not.toThrow();
			expect(() => new Fami({ session: { prefix: "host" } })).not.toThrow();
			expect(
				() => new Fami({ session: { prefix: "host", path: "/" } }),
			).not.toThrow();
		});

		test("rejects __Secure-/__Host- schema names without required attrs", () => {
			expect(() => new Fami({ "__Secure-session": {} })).toThrow(
				InvalidAttributeError,
			);
			expect(() => new Fami({ "__Host-session": {} })).toThrow(
				InvalidAttributeError,
			);
			expect(
				() =>
					new Fami({
						"__Host-session": { secure: true, path: "/admin" },
					}),
			).toThrow(InvalidAttributeError);
		});

		test("prefix detection is case-sensitive", () => {
			expect(() => new Fami({ "__secure-session": {} })).not.toThrow();
			expect(() => new Fami({ "__host-session": {} })).not.toThrow();
		});
	});

	describe("prefixes", () => {
		test("serializes prefixed cookies from unprefixed schema names", () => {
			const fami = new Fami({
				session: { prefix: "host" },
				csrf: { prefix: "secure" },
			});

			expect(fami.serialize("session", "abc123")).toBe(
				"__Host-session=abc123; Path=/; Secure",
			);
			expect(fami.serialize("csrf", "token")).toBe(
				"__Secure-csrf=token; Secure",
			);
		});

		test("parses prefixed wire cookie names back to schema names", () => {
			const fami = new Fami({
				session: { prefix: "host" },
				csrf: { prefix: "secure" },
				theme: {},
			});

			const result = fami.parse(
				"__Host-session=abc123; __Secure-csrf=token; theme=dark",
			);

			expect(result).toEqual({
				session: "abc123",
				csrf: "token",
				theme: "dark",
			});
		});

		test("does not accept unprefixed values for prefixed schema cookies", () => {
			const fami = new Fami({ session: { prefix: "host" } });

			expect(fami.parse("session=abc123")).toEqual({ session: undefined });
		});
	});

	describe("serialize", () => {
		test("uses default attributes from definition", () => {
			const fami = new Fami({
				session: { httpOnly: true, secure: true, sameSite: "strict" },
			});

			const result = fami.serialize("session", "abc123");

			expect(result).toStartWith("session=abc123;");
			expect(result).toContain("HttpOnly");
			expect(result).toContain("Secure");
			expect(result).toContain("SameSite=Strict");
		});

		test("overrides default attributes with call-site attributes", () => {
			const fami = new Fami({ session: { sameSite: "strict" } });

			const result = fami.serialize("session", "abc123", { sameSite: "lax" });

			expect(result).toStartWith("session=abc123;");
			expect(result).toContain("SameSite=Lax");
			expect(result).not.toContain("SameSite=Strict");
		});

		test("calls expires function from definition", () => {
			const expiresDate = new Date("2025-12-31T00:00:00Z");
			const fami = new Fami({ session: { expires: () => expiresDate } });

			const result = fami.serialize("session", "abc123");

			expect(result).toContain("Expires=Wed, 31 Dec 2025 00:00:00 GMT");
		});

		test("call-site expires takes precedence over the definition's expires fn", () => {
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

			expect(result).toContain("Expires=Thu, 01 Jan 2026 00:00:00 GMT");
		});

		test("serializes cookie without default attributes", () => {
			const fami = new Fami({ tracking: {} });

			expect(fami.serialize("tracking", "value123")).toBe("tracking=value123");
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
		test("returns registered cookies", () => {
			const fami = new Fami({ session: {}, tracking: {} });

			const result = fami.parse("session=abc123; tracking=xyz789");

			expect(result).toEqual({ session: "abc123", tracking: "xyz789" });
		});

		test("returns undefined for missing cookies", () => {
			const fami = new Fami({ session: {}, tracking: {} });

			expect(fami.parse("session=abc123")).toEqual({
				session: "abc123",
				tracking: undefined,
			});
		});

		test("ignores unregistered cookies", () => {
			const fami = new Fami({ session: {} });

			const result = fami.parse("session=abc123; unregistered=value");

			expect(result).toEqual({ session: "abc123" });
			expect("unregistered" in result).toBe(false);
		});

		test("handles empty cookie header", () => {
			const fami = new Fami({ session: {}, tracking: {} });

			expect(fami.parse("")).toEqual({
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

		test("includes default attributes from definition", () => {
			const fami = new Fami({
				session: { path: "/", domain: "example.com" },
			});

			const result = fami.delete("session");

			expect(result).toStartWith("session=;");
			expect(result).toContain("Path=/");
			expect(result).toContain("Domain=example.com");
		});
	});

	describe("introspection", () => {
		test("getDefinition returns cookie definition", () => {
			const fami = new Fami({
				session: { httpOnly: true, secure: true },
			});

			expect(fami.getDefinition("session")).toEqual({
				httpOnly: true,
				secure: true,
			});
		});

		test("getDefinition returns undefined for unregistered cookies", () => {
			const fami = new Fami({ session: {} });

			// @ts-expect-error - testing runtime behavior
			expect(fami.getDefinition("unregistered")).toBeUndefined();
		});

		test("has narrows registered cookie names", () => {
			const fami = new Fami({ session: {} });

			expect(fami.has("session")).toBe(true);
			expect(fami.has("unregistered")).toBe(false);
		});

		test("getNames returns all registered cookies in insertion order", () => {
			const fami = new Fami({ session: {}, tracking: {}, preferences: {} });

			expect(fami.getNames()).toEqual(["session", "tracking", "preferences"]);
		});

		test("getNames returns empty array when no cookies are registered", () => {
			expect(new Fami({}).getNames()).toEqual([]);
		});

		test("cookies returns immutable, copied definitions", () => {
			const definitions = {
				session: { path: "/", httpOnly: true },
			};
			const fami = new Fami(definitions);

			expect(Object.isFrozen(fami.cookies)).toBe(true);
			expect(Object.isFrozen(fami.cookies.session)).toBe(true);

			definitions.session.path = "/changed";
			expect(fami.serialize("session", "value")).toBe(
				"session=value; Path=/; HttpOnly",
			);

			expect(() => {
				(fami.cookies as Record<string, unknown>).session = {};
			}).toThrow();
			expect(() => {
				(fami.cookies.session as { path?: string }).path = "/";
			}).toThrow();
		});
	});

	describe("signed cookies", () => {
		const signedSchema = {
			session: {
				httpOnly: true,
				secure: true,
				sameSite: "strict",
				secret: "super-secret",
			},
			tracking: {},
		} as const;

		test("serialize returns a Promise only for secret cookies", async () => {
			const fami = new Fami(signedSchema);

			const session = fami.serialize("session", "abc123");
			const tracking = fami.serialize("tracking", "value");

			expect(session).toBeInstanceOf(Promise);
			expect(tracking).not.toBeInstanceOf(Promise);

			expect(await session).toStartWith("session=abc123.");
			expect(await session).toContain("; HttpOnly");
			expect(tracking).toBe("tracking=value");
		});

		test("serializes signed empty values as empty unsigned values", async () => {
			const fami = new Fami(signedSchema);

			const header = await fami.serialize("session", "");

			expect(header).toStartWith("session=;");
			expect(header).not.toStartWith("session=.");
			expect(header).toContain("; HttpOnly");
			expect(header).toContain("; Secure");
			expect(header).toContain("; SameSite=Strict");

			const cookies = fami.parse("session=");
			expect(await cookies.session).toBeUndefined();
		});

		test("delete returns a Promise only for secret cookies", async () => {
			const fami = new Fami(signedSchema);

			const session = fami.delete("session");
			const tracking = fami.delete("tracking");

			expect(session).toBeInstanceOf(Promise);
			expect(tracking).not.toBeInstanceOf(Promise);

			expect(await session).toStartWith("session=;");
			expect(await session).toContain("Max-Age=0");
			expect(tracking).toStartWith("tracking=;");
		});

		test("parse returns a Promise only for secret cookies", async () => {
			const fami = new Fami(signedSchema);

			const cookies = fami.parse(
				"session=abc123.BQMG5r8LnjayZExNmMxnQ0rkwWy0_TTsAoqCu84uX7A; tracking=xyz789",
			);

			expect(cookies.session).toBeInstanceOf(Promise);
			expect(cookies.tracking).not.toBeInstanceOf(Promise);

			expect(await cookies.session).toBe("abc123");
			expect(cookies.tracking).toBe("xyz789");
		});

		test("parse resolves to undefined for tampered signed cookies", async () => {
			const fami = new Fami(signedSchema);

			const cookies = fami.parse(
				"session=abc123.BQMG5r8LnjayZExNmmxnQ0rkwWy0_TTsAoqCu84uX7A",
			);

			expect(await cookies.session).toBeUndefined();
		});

		test("reuses the imported HMAC key", async () => {
			const importSpy = spyOn(crypto.subtle, "importKey");

			try {
				const fami = new Fami(signedSchema);

				await fami.serialize("session", "a");
				await fami.serialize("session", "b");
				await fami.parse(
					"session=abc123.BQMG5r8LnjayZExNmMxnQ0rkwWy0_TTsAoqCu84uX7A",
				).session;

				expect(importSpy).toHaveBeenCalledTimes(1);
			} finally {
				importSpy.mockRestore();
			}
		});
	});

	describe("type inference", () => {
		test("InferCookieNames extracts the cookie name union", () => {
			const fami = new Fami({
				session: { httpOnly: true },
				tracking: {},
			});
			type Names = InferCookieNames<typeof fami>;

			const _: Expect<Names, "session" | "tracking"> = true;
			expect(_).toBe(true);
		});

		test("serialize, parse, and delete infer names from the schema", () => {
			const fami = new Fami({
				auth: { httpOnly: true, secure: true },
				theme: {},
			});

			expect(fami.serialize("auth", "token")).toStartWith("auth=token;");

			const parsed = fami.parse("auth=token; theme=dark");
			expect(parsed.auth).toBe("token");
			expect(parsed.theme).toBe("dark");

			expect(fami.delete("theme")).toStartWith("theme=;");

			type ParsedKeys = keyof typeof parsed;
			const _: Expect<ParsedKeys, "auth" | "theme"> = true;
			expect(_).toBe(true);
		});
	});

	describe("description metadata", () => {
		test("description is stored on the definition", () => {
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

	describe("null-prototype storage", () => {
		test("accepts reserved keys as cookie names", () => {
			const fami = new Fami({
				["__proto__"]: {},
				constructor: {},
				session: {},
			});

			expect(fami.getNames()).toContain("__proto__");
			expect(fami.getNames()).toContain("constructor");
			expect(fami.has("__proto__")).toBe(true);
			expect(fami.has("constructor")).toBe(true);
		});

		test("parses reserved keys as own properties", () => {
			const fami = new Fami({
				["__proto__"]: {},
				constructor: {},
				session: {},
			});

			const result = fami.parse(
				"__proto__=polluted; constructor=evil; session=abc123",
			);

			expect(Object.hasOwn(result, "__proto__")).toBe(true);
			expect(Object.hasOwn(result, "constructor")).toBe(true);
			expect(result.__proto__).toBe("polluted");
			expect(result.constructor).toBe("evil");
			expect(result.session).toBe("abc123");
		});

		test("does not mutate Object.prototype", () => {
			const fami = new Fami({ ["__proto__"]: {}, constructor: {} });

			fami.serialize("__proto__", "value");
			fami.parse("__proto__=polluted; constructor=evil");

			expect(({} as Record<string, unknown>).polluted).toBeUndefined();
			expect(Object.keys(Object.prototype)).toEqual([]);
		});

		test("serializes reserved keys as plain cookies", () => {
			const fami = new Fami({ ["__proto__"]: {}, constructor: {} });

			expect(fami.serialize("__proto__", "value")).toBe("__proto__=value");
			expect(fami.serialize("constructor", "value")).toBe("constructor=value");
		});
	});
});
