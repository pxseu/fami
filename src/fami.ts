import { signPipeline, verifyPipeline } from "./crypto";
import { FamiError, InvalidAttributeError, InvalidNameError } from "./errors";
import {
	entries,
	isValidCookieDomain,
	isValidCookieName,
	isValidCookiePath,
	keys,
	lowercase,
	newObject,
	VALID_PRIORITY_VALUES,
	VALID_SAME_SITE_VALUES,
} from "./helpers";
import { parse as parseRaw, serialize as serializeRaw } from "./parser";
import type { CookieAttributes, CookieValue, MaybePromise } from "./types";

/**
 * Fami cookies object. Can be used to access parsed cookie values with correct types, including promise types for secret cookies.
 *
 * For each registered cookie name, the value is either a string or a promise of a string if the cookie is signed with a secret.
 * If the cookie is not present in the parsed header, the value will be undefined (or a promise of undefined for secret cookies).
 * If the cookie is signed but fails verification, the value will be undefined (not a rejected promise) to simplify error handling.
 */
export type FamiCookies<
	CookieName extends string,
	Defs extends FamiInput<CookieName>,
> = {
	[C in CookieName]: PromiseIfSecret<C, Defs, string | undefined>;
};

// Phantom type to ensure the name is "used" by TypeScript
export type CookieDefinition<_ extends string> = Partial<{
	/**
	 * A description of the cookie.
	 *
	 * This has no functional purpose, but is useful for documentation and debugging.
	 */
	description: string;

	/**
	 * A function that returns the expiration date of the cookie
	 * This is useful for cookies that need to be refreshed periodically
	 * If both `expires` and `maxAge` are set, `maxAge` has precedence.
	 * Both should **NOT** be used together, but if they are they should point the same value.
	 *
	 * @example
	 * ```ts
	 * // always returns a date 30 days from serializing the cookie
	 * () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
	 * ```
	 *
	 * @see https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Set-Cookie#expiresdate
	 */
	expires: () => Date;

	secret: string;
}> &
	Omit<CookieAttributes, "expires">;

/**
 * A mapping of cookie names to their definitions, used as the input to the {@link Fami} constructor.
 *
 * Each key is a cookie name and each value is a {@link CookieDefinition} specifying
 * default attributes (e.g. `httpOnly`, `secure`, `sameSite`, `expires`, `secret`) for that cookie.
 */
export type FamiInput<Name extends string> = {
	readonly [K in Name]: CookieDefinition<K>;
};

/**
 * Conditionally wraps `Return` in a `Promise` when the cookie definition for `Name` includes a `secret`.
 *
 * Cookies signed with a secret require async crypto operations, so their
 * return types are promises. Unsigned cookies resolve synchronously.
 */
export type PromiseIfSecret<
	Name extends string,
	Def extends FamiInput<Name>,
	Return = string,
> = Def[Name] extends { secret: unknown } ? Promise<Return> : Return;

/**
 * Fami - A type-safe cookie manager for modern web applications
 *
 * Fami provides a strongly-typed API for managing HTTP cookies with compile-time
 * name checking and runtime validation. Define your cookies once with their
 * default attributes, then serialize and parse them with full type safety.
 *
 * @example
 * ```ts
 * const cookies = new Fami({
 *   tracking: {},
 *   session: {
 *     httpOnly: true,
 *     secure: true,
 *     sameSite: "strict",
 *     expires: () => new Date(Date.now() + 86400000), // 1 day
 *   },
 * });
 *
 * // Serialize with type checking - "session" and "tracking" are autocompleted!
 * const header = cookies.serialize("session", "abc123");
 * // => "session=abc123; HttpOnly; Secure; SameSite=Strict; Expires=..."
 *
 * // Parse with guaranteed shape
 * const parsed = cookies.parse(req.headers.get("Cookie"));
 * // => { session: "abc123" | undefined, tracking: "..." | undefined }
 *
 * // Delete a cookie
 * const deleteHeader = cookies.delete("session");
 * ```
 *
 * @example
 * ```ts
 * const cookies = new Fami({
 *   session: {},
 *   theme: {},
 * });
 * type Names = InferCookieNames<typeof cookies>; // "session" | "theme"
 * ```
 */
export class Fami<
	CookieName extends string,
	Definition extends FamiInput<CookieName>,
> {
	readonly #cookies: Readonly<Definition>;

	/**
	 * @param cookieDefinitions An object mapping cookie names to definitions
	 */
	constructor(input: FamiInput<CookieName> & Definition) {
		// freeze the cookies object to prevent mutation via the public API
		this.#cookies = Object.freeze(
			entries(input).reduce((cookies, [name, definition]) => {
				if (cookies[name]) {
					throw new FamiError(`Cookie name ${name} is already registered`);
				}

				if (!isValidCookieName(name)) {
					throw new InvalidNameError(name);
				}

				if (definition?.domain && !isValidCookieDomain(definition.domain)) {
					throw new InvalidAttributeError("domain", definition.domain);
				}

				if (definition?.path && !isValidCookiePath(definition.path)) {
					throw new InvalidAttributeError("path", definition.path);
				}

				if (definition?.priority) {
					const lower = lowercase(definition.priority);

					if (!VALID_PRIORITY_VALUES.includes(lower)) {
						throw new InvalidAttributeError(
							"priority",
							lower,
							VALID_PRIORITY_VALUES,
						);
					}
				}

				if (definition?.sameSite) {
					const lower = lowercase(definition.sameSite);

					if (!VALID_SAME_SITE_VALUES.includes(lower)) {
						throw new InvalidAttributeError(
							"SameSite",
							lower,
							VALID_SAME_SITE_VALUES,
						);
					}
				}

				cookies[name] = definition;
				return cookies;
			}, newObject<Definition>()),
		);
	}

	/**
	 * Serializes a cookie with the registered name and default attributes
	 * @param name the registered cookie name
	 * @param value the cookie value
	 * @param attributes optional attributes to override or extend the defaults
	 * @returns Set-Cookie header value string or a promise of it if the cookie is signed with a secret
	 */
	serialize<Name extends CookieName>(
		name: Name,
		value: CookieValue,
		attributes?: CookieAttributes,
	): PromiseIfSecret<Name, Definition>;
	serialize(
		name: CookieName,
		value: CookieValue,
		attributes?: CookieAttributes,
	): MaybePromise<string> {
		if (!this.#cookies[name]) {
			console.warn(
				`Unregistered cookie name (${name}) was used. Consider registering it in your Fami instance for better type safety and default attributes.`,
			);
		}

		const attribute = {
			...(this.#cookies[name] ?? {}),
			...attributes,
			expires: attributes?.expires ?? this.#cookies[name]?.expires?.(),
		};

		if (attribute.secret) {
			return signPipeline(attribute.secret, String(value)).then((signed) =>
				serializeRaw(name, signed, attribute),
			);
		}

		return serializeRaw(name, value, attribute);
	}

	/**
	 * Parse a Cookie header value into a record of cookie names and values
	 * @param cookieHeader The Cookie header value to parse
	 * @returns `FamiCookies` object with cookie names as keys and parsed values (or promises of values for secret cookies)
	 * @remarks For secret cookies, if the cookie is not present or fails verification, the value will be undefined (not a rejected promise) to simplify error handling.
	 */
	parse(
		cookieHeader: Parameters<typeof parseRaw>[0],
	): FamiCookies<CookieName, Definition> {
		const parsed = parseRaw(cookieHeader);

		const cookies = newObject<FamiCookies<CookieName, Definition>>();

		for (const name of keys(this.#cookies)) {
			cookies[name] = this.parseOne(name, parsed[name]);
		}

		return cookies;
	}

	private parseOne<Name extends CookieName>(
		name: Name,
		raw: string | undefined,
	): PromiseIfSecret<Name, Definition, string | undefined>;
	private parseOne(
		name: CookieName,
		raw: string | undefined,
	): MaybePromise<string | undefined> {
		const secret = this.#cookies[name]?.secret;

		if (secret) {
			return verifyPipeline(secret, raw).then((v) =>
				v === false ? undefined : v,
			);
		}

		return raw;
	}

	/**
	 * Create a Set-Cookie header that removes the cookie from the client (set maxAge to 0 and expires to `new Date(0)`)
	 * @param name the cookie name to delete
	 * @returns the Set-Cookie header value to delete the cookie or a promise of it if the cookie is signed with a secret
	 */
	delete<Name extends CookieName>(
		name: Name,
	): PromiseIfSecret<Name, Definition> {
		return this.serialize(name, "", {
			maxAge: 0,
			expires: new Date(0),
		});
	}

	/**
	 * Get the definition for a registered cookie
	 * @param name the cookie name
	 * @returns the cookie definition or undefined if not registered
	 */
	getDefinition<Name extends CookieName>(
		name: Name,
	): Definition[Name] | undefined {
		return this.#cookies[name];
	}

	/**
	 * Check if a cookie name is registered
	 * @param name the cookie name to check
	 * @returns true if the cookie is registered
	 */
	has(name: string): name is CookieName {
		return name in this.#cookies;
	}

	/**
	 * Get all registered cookie names
	 * @returns array of registered cookie names
	 */
	getNames(): CookieName[] {
		return keys(this.#cookies);
	}

	/**
	 * All registered cookies
	 */
	get cookies(): Definition {
		return this.#cookies;
	}
}

/**
 * Infer the cookie names from a Fami instance
 *
 * @example
 * ```ts
 * const fami = new Fami({ tracking: {}, session: {} });
 * type Names = InferCookieNames<typeof fami>; // "tracking" | "session"
 * ```
 */
export type InferCookieNames<T> =
	T extends Fami<infer Names, infer _Defs> ? Names : never;
