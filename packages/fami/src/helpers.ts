import {
	InvalidAttributeError,
	InvalidDateError,
	InvalidNameError,
	InvalidValueError,
} from "./errors";
import type { CookieAttributes, CookieHeader, CookiePrefix } from "./types";

export const COOKIE_SEPARATORS = /[;,]/;
export const NAME_VALUE_MATCHER = /^([^=]+)=(.*)$/s;

export function formatHttpDate(date: Date): string {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
		throw new InvalidDateError();
	}

	// toUTCString returns the HTTP-date format ref:
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toUTCString
	return date.toUTCString();
}

// RFC 6265bis cookie-name is an HTTP token: visible ASCII excluding separators.
const COOKIE_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
export function isValidCookieName(name: string | undefined): name is string {
	return !!name && COOKIE_NAME.test(name);
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: same control range as cookie-name validation.
const INVALID_DOMAIN_CHARACTERS = /[\x00-\x20\x7F;,]/;
const DOMAIN_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
export function isValidCookieDomain(domain: string): boolean {
	if (!domain || INVALID_DOMAIN_CHARACTERS.test(domain)) return false;

	const normalized = domain.startsWith(".") ? domain.slice(1) : domain;
	return (
		normalized.length > 0 &&
		normalized.length <= 253 &&
		normalized.split(".").every((label) => DOMAIN_LABEL.test(label))
	);
}

// RFC 6265bis av-octet is visible US-ASCII plus space, excluding semicolon.
const COOKIE_ATTRIBUTE_VALUE = /^[\x20-\x3A\x3C-\x7E]+$/;
export function isValidCookiePath(path: string): boolean {
	return COOKIE_ATTRIBUTE_VALUE.test(path);
}

export function isValidMaxAge(maxAge: number): boolean {
	return Number.isSafeInteger(maxAge) && maxAge >= 0;
}

const ESCAPE_CHARACTERS = /\\(.)/g;
function unquoteCookieValue(value: string): string {
	// must be at least both quotes
	if (value.length < 2 || !value.startsWith('"') || !value.endsWith('"')) {
		return value;
	}

	// Unescape \" and \\ sequences
	return value.slice(1, -1).replace(ESCAPE_CHARACTERS, "$1");
}

export function decodeCookieValue(value: string): string {
	if (!value) return "";

	const unquotedValue = unquoteCookieValue(value);

	if (!unquotedValue.includes("%")) {
		return unquotedValue;
	}

	try {
		// not strictly required by the RFC, but a lot of implementations do this
		return decodeURIComponent(unquotedValue);
	} catch {
		return unquotedValue;
	}
}

// Encode anything outside RFC 6265bis cookie-octet, plus percent to preserve decode round-trips.
const NEEDS_ENCODING = /[^\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]|%/;

export function encodeCookieValue(value: string): string {
	if (!NEEDS_ENCODING.test(value)) {
		return value;
	}

	try {
		// encodeURIComponent throws on lone surrogates
		return encodeURIComponent(value);
	} catch {
		throw new InvalidValueError();
	}
}

// RFC 6265 values, lowercase for ease of use, later capitalized for serialization
export const VALID_SAME_SITE_VALUES = ["strict", "lax", "none"] as const;
export const VALID_PRIORITY_VALUES = ["low", "medium", "high"] as const;
export const VALID_PREFIX_VALUES = ["secure", "host"] as const;

// RFC 6265bis cookie prefixes are case-sensitive on the wire.
export function isSecureCookieName(name: string): boolean {
	return name.startsWith("__Secure-");
}

export function isHostCookieName(name: string): boolean {
	return name.startsWith("__Host-");
}

export function prefixCookieName(
	name: string,
	prefix: CookiePrefix | undefined,
): string {
	if (prefix === "secure") return `__Secure-${name}`;
	if (prefix === "host") return `__Host-${name}`;
	return name;
}

export function lowercase<T extends string>(str: T): Lowercase<T> {
	return str.toLowerCase() as Lowercase<T>;
}

export function capitalize<T extends string>(str: T): Capitalize<T> {
	return (str.slice(0, 1).toUpperCase() + str.slice(1)) as Capitalize<T>;
}

export function newObject<T extends object>(): T {
	return Object.create(null) as T;
}

export function entries<
	K extends string,
	T extends Readonly<Record<K, unknown>>,
>(obj: Record<K, unknown> & T): [K, T[K]][] {
	return Object.entries(obj) as [K, T[K]][];
}

export function keys<K extends string>(obj: Readonly<Record<K, unknown>>): K[] {
	return Object.keys(obj) as K[];
}

/**
 * Maps a schema name + definition to its wire name and prefix-derived
 * `secure`/`path` defaults.
 */
export function resolveWire(
	name: string,
	definition: Readonly<{ prefix?: CookiePrefix }> | undefined,
): { wireName: string; secure: boolean; path: string | undefined } {
	if (definition?.prefix === undefined) {
		return { wireName: name, secure: false, path: undefined };
	}

	const prefix = lowercase(definition.prefix);
	if (!VALID_PREFIX_VALUES.includes(prefix)) {
		throw new InvalidAttributeError("prefix", prefix, VALID_PREFIX_VALUES);
	}

	return {
		wireName: prefixCookieName(name, prefix),
		secure: true,
		path: prefix === "host" ? "/" : undefined,
	};
}

export function normalizeCookieHeader(
	cookieHeader: CookieHeader,
): string | undefined {
	if (!cookieHeader) {
		return undefined;
	}

	if (typeof cookieHeader === "string") {
		return cookieHeader;
	}

	return cookieHeader.join("; ");
}

/**
 * Validates a wire-form cookie name and its attributes against RFC 6265bis.
 * Returns the resolved `secure` and `path`.
 */
export function validateAttributes(
	name: string,
	attrs: Omit<CookieAttributes, "expires"> | undefined,
): { secure: boolean; path: string | undefined } {
	if (!isValidCookieName(name)) {
		throw new InvalidNameError(name);
	}

	const secure = !!attrs?.secure;
	const path =
		isHostCookieName(name) && attrs?.path === undefined ? "/" : attrs?.path;

	if (isSecureCookieName(name) && !secure) {
		throw new InvalidAttributeError("__Secure- prefix", "missing Secure");
	}

	if (isHostCookieName(name)) {
		if (!secure) {
			throw new InvalidAttributeError("__Host- prefix", "missing Secure");
		}
		if (attrs?.domain !== undefined) {
			throw new InvalidAttributeError("__Host- prefix", "Domain");
		}
		if (path !== "/") {
			throw new InvalidAttributeError("__Host- prefix", "Path must be /");
		}
	}

	if (attrs?.domain !== undefined && !isValidCookieDomain(attrs.domain)) {
		throw new InvalidAttributeError("domain", attrs.domain);
	}

	if (path !== undefined && !isValidCookiePath(path)) {
		throw new InvalidAttributeError("path", path);
	}

	if (attrs?.maxAge !== undefined && !isValidMaxAge(attrs.maxAge)) {
		throw new InvalidAttributeError("maxAge", String(attrs.maxAge));
	}

	if (attrs?.priority !== undefined) {
		const lower = lowercase(attrs.priority);
		if (!VALID_PRIORITY_VALUES.includes(lower)) {
			throw new InvalidAttributeError("priority", lower, VALID_PRIORITY_VALUES);
		}
	}

	if (attrs?.sameSite !== undefined) {
		const lower = lowercase(attrs.sameSite);
		if (!VALID_SAME_SITE_VALUES.includes(lower)) {
			throw new InvalidAttributeError(
				"SameSite",
				lower,
				VALID_SAME_SITE_VALUES,
			);
		}
		if (lower === "none" && !secure) {
			throw new InvalidAttributeError("SameSite=None", "missing Secure");
		}
	}

	if (attrs?.partitioned && !secure) {
		throw new InvalidAttributeError("Partitioned", "missing Secure");
	}

	return { secure, path };
}
