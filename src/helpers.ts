import { InvalidDateError } from "./errors";

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

// Cookie name should not contain control characters, separators, or whitespace
// RFC 6265bis allows most characters except control chars and separators, so basically HTTP tokens as per RFC 2616
// biome-ignore lint/suspicious/noControlCharactersInRegex: as above
const INVALID_CHARACTERS = /[\x00-\x1F\x7F()<>@,;:\\"/[\]?={}\s]/;
export function isValidCookieName(name: string | undefined): name is string {
	return !!name && !INVALID_CHARACTERS.test(name);
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: simmilar as above
const INVALID_DOMAIN_CHARACTERS = /[\x00-\x20\x7F;,]/;
export function isValidCookieDomain(domain: string): boolean {
	return !!domain && !INVALID_DOMAIN_CHARACTERS.test(domain);
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: simmilar as above
const INVALID_PATH_CHARACTERS = /[\x00-\x1F\x7F;]/;
export function isValidCookiePath(path: string): boolean {
	return !!path && !INVALID_PATH_CHARACTERS.test(path);
}

const ESCAPE_CHARACTERS = /\\(.)/g;
function unquoteCookieValue(value: string): string {
	// make sure the value is AT least both quotes
	if (value.length < 2 || !value.startsWith('"') || !value.endsWith('"')) {
		return value;
	}

	// Unescape \" and \\ sequences
	return value.slice(1, -1).replace(ESCAPE_CHARACTERS, "$1");
}

export function decodeCookieValue(value: string): string {
	// if empty short circuit
	if (!value) return "";

	// unquote the value, odds are it still could be encoded
	const unquotedValue = unquoteCookieValue(value);

	if (unquotedValue.indexOf("%") === -1) {
		return unquotedValue;
	}

	try {
		// the is not required per-se by the RFC, but a lot of implementations do this
		return decodeURIComponent(unquotedValue);
	} catch (_) {
		return unquotedValue;
	}
}

// Characters that need to be escaped when quoted: backslash and double quote
const ESCAPABLE_CHARACTERS = /[\\"]/g;

// Encode non-ASCII/control bytes and delimiter characters to preserve round-trips.
const NEEDS_ENCODING = /[^\x20-\x7E]|[;,]/;

// Characters that need quoting or escaping in unquoted values
const SPECIAL_CHARACTERS = /[\s"\\]/;

export function encodeCookieValue(value: string): string {
	if (NEEDS_ENCODING.test(value)) {
		return encodeURIComponent(value);
	}

	// the value is quotable, so we need to escape it
	if (SPECIAL_CHARACTERS.test(value)) {
		// escape backslashes and double quotes, then wrap in quotes
		const escaped = value.replace(ESCAPABLE_CHARACTERS, "\\$&");
		return `"${escaped}"`;
	}

	return value;
}

// RFC 6265 values, lowercase for ease of use, later capitalized for serialization
export const VALID_SAME_SITE_VALUES = ["strict", "lax", "none"] as const;
export const VALID_PRIORITY_VALUES = ["low", "medium", "high"] as const;

// Helper, internally lowercase values for comparison
export function lowercase<T extends string>(str: T): Lowercase<T> {
	return str.toLowerCase() as Lowercase<T>;
}

export function capitalize<T extends string>(str: T): Capitalize<T> {
	return (str.charAt(0).toUpperCase() + str.slice(1)) as Capitalize<T>;
}

export function newObject<T extends object>(): T {
	return Object.create(null) as T;
}

export function entries<T extends object>(obj: T): [keyof T, T[keyof T]][] {
	return Object.entries(obj) as [keyof T, T[keyof T]][];
}

export function keys<T extends object>(obj: T): (keyof T)[] {
	return Object.keys(obj) as (keyof T)[];
}
