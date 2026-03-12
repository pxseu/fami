import { FamiError, InvalidAttributeError, InvalidNameError } from "./errors";
import {
	entries,
	isArray,
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
import type { CookieAttributes, CookieValue } from "./types";

/**
 * Cookies returned by `fami`
 */
export type FamiCookies<CookieName extends string> = Partial<
	Record<CookieName, string>
>;

/**
 *  Cookies that have been verified by `fami`. The value is either the original string or null if the signature is invalid.
 */
export type FamiSignedCookies<CookieName extends string> = Partial<
	Record<CookieName, string | null>
>;

// Phantom type to ensure the name is "used" by TypeScript
export type CookieDefinition<_ extends string> = Partial<{
	/**
	 * A description of the cookie
	 * This has no functional purpose, but is useful for documentation and debugging
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
}> &
	Omit<CookieAttributes, "expires">;

export type CookieArray<Name extends string> = ReadonlyArray<
	Name | ({ name: Name } & CookieDefinition<Name>)
>;

export type CookieRecord<Name extends string> = {
	readonly [K in Name]: CookieDefinition<K>;
};

export type FamiInput<CookieName extends string> =
	| CookieArray<CookieName>
	| CookieRecord<CookieName>;

/**
 * Fami - A type-safe cookie manager for modern web applications
 *
 * Fami provides a strongly-typed API for managing HTTP cookies with compile-time
 * name checking and runtime validation. Define your cookies once with their
 * default attributes, then serialize and parse them with full type safety.
 *
 * @example Array initialization
 * ```ts
 * const cookies = new Fami([
 *   "tracking",
 *   {
 *     name: "session",
 *     httpOnly: true,
 *     secure: true,
 *     sameSite: "strict",
 *     expires: () => new Date(Date.now() + 86400000), // 1 day
 *   },
 * ]);
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
 * @example Object initialization
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
 * ```
 *
 * @example Type inference
 * ```ts
 * const cookies = new Fami(["session", "theme"]);
 * type Names = InferCookieNames<typeof cookies>; // "session" | "theme"
 * ```
 */
export class Fami<CookieName extends string> {
	readonly #cookies: Record<CookieName, CookieDefinition<CookieName>>;

	/**
	 * @param cookieDefinitions A list of cookie definitions to initialize with
	 */
	constructor(cookieDefinitions: CookieArray<CookieName>);
	/**
	 * @param cookieDefinitions An object mapping cookie names to definitions
	 */
	constructor(cookieDefinitions: CookieRecord<CookieName>);
	constructor(cookieDefinitions: FamiInput<CookieName>);
	constructor(input: FamiInput<CookieName>) {
		const cookieDefinitions = isArray(input)
			? input
			: entries(input).map(([name, definition]) =>
					Object.assign({ name }, definition),
				);

		// freeze the cookies object to prevent mutation via the public API
		this.#cookies = Object.freeze(
			cookieDefinitions.reduce((cookies, input) => {
				const { name, ...definition } =
					typeof input === "string" ? { name: input } : input;

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

				if (typeof input === "string") {
					cookies[name] = {};
					return cookies;
				}

				cookies[name] = definition;
				return cookies;
			}, newObject<Record<CookieName, CookieDefinition<CookieName>>>()),
		);
	}

	/**
	 * Serializes a cookie with the registered name and default attributes
	 * @param name the registered cookie name
	 * @param value the cookie value
	 * @param attributes optional attributes to override or extend the defaults
	 * @returns Set-Cookie header value string
	 */
	serialize(
		name: CookieName,
		value: CookieValue,
		attributes?: CookieAttributes,
	): string {
		if (!this.#cookies[name]) {
			console.warn(
				`Unregistered cookie name (${name}) was used. Consider registering it in your Fami instance for better type safety and default attributes.`,
			);
		}

		const { expires: expiresFn, ...defaults } = this.#cookies[name] ?? {};

		return serializeRaw(name, value, {
			...defaults,
			...attributes,
			expires: attributes?.expires ?? expiresFn?.(),
		});
	}

	/**
	 * Serialize all cookies in the record
	 * @param cookies the cookies to serialize, either a string value or an object with a `value` property and optional attributes
	 * @returns the Set-Cookie header value strings
	 */
	serializeAll(
		cookies: Partial<
			Record<
				CookieName,
				CookieValue | ({ value: CookieValue } & CookieAttributes)
			>
		>,
	): string[] {
		const out: string[] = [];

		for (const [name, maybeValue] of entries(cookies)) {
			// undefined values are ignored
			if (maybeValue == null) continue;

			const { value, ...attributes } =
				typeof maybeValue !== "object" ? { value: maybeValue } : maybeValue;

			out.push(this.serialize(name, value, attributes));
		}

		return out;
	}

	/**
	 * Parse a Cookie header value into a record of cookie names and values
	 * @param cookieHeader The Cookie header value to parse
	 * @returns A record of cookie names and values
	 */
	parse(cookieHeader: Parameters<typeof parseRaw>[0]): FamiCookies<CookieName> {
		const parsed = parseRaw(cookieHeader);

		const cookies = newObject<FamiCookies<CookieName>>();

		for (const name of keys(this.#cookies)) {
			cookies[name] = parsed[name];
		}

		return cookies;
	}

	/**
	 * Create a Set-Cookie header that removes the cookie from the client (set maxAge to 0 and expires to `new Date(0)`)
	 * @param name the cookie name to delete
	 * @returns the Set-Cookie header value to delete the cookie
	 */
	delete(name: CookieName): string {
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
	getDefinition(name: CookieName): CookieDefinition<CookieName> | undefined {
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
		return Object.keys(this.#cookies) as CookieName[];
	}

	/**
	 * All registered cookies
	 */
	get cookies(): Record<CookieName, CookieDefinition<CookieName>> {
		return this.#cookies;
	}
}

/**
 * Infer the cookie names from a Fami instance
 *
 * @example
 * ```ts
 * const fami = new Fami(["tracking", "session"]);
 * type Names = InferCookieNames<typeof fami>; // "tracking" | "session"
 * ```
 */
export type InferCookieNames<T extends Fami<string>> =
	T extends Fami<infer Names> ? Names : never;
