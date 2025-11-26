import { InvalidDateError } from "./errors";

export const formatHttpDate = (date: Date): string => {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
		throw new InvalidDateError();
	}

	// toUTCString returns the HTTP-date format ref:
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toUTCString
	return date.toUTCString();
};

// Cookie name should not contain control characters, separators, or whitespace
// RFC 6265bis allows most characters except control chars and separators, so basically HTTP tokens as per RFC 2616
// biome-ignore lint/suspicious/noControlCharactersInRegex: as above
const INVALID_CHARACTERS = /[\x00-\x1F\x7F()<>@,;:\\"/[\]?={}\s]/;

export const isValidCookieName = (name: string): boolean =>
	!!name && !INVALID_CHARACTERS.test(name);

const ESCAPE_CHARACTERS = /\\(.)/g;

const unquoteCookieValue = (value: string): string => {
	if (value.startsWith('"') && value.endsWith('"')) {
		// Unescape \" and \\ sequences
		return value.slice(1, -1).replace(ESCAPE_CHARACTERS, "$1");
	}

	return value;
};

export const decodeCookieValue = (value: string): string => {
	// if empty short circuit
	if (!value) return "";

	// unquote the value, odds are it still could be encoded
	const unquotedValue = unquoteCookieValue(value);

	try {
		// the is not required per-se by the RFC, but a lot of implementations do this
		return decodeURIComponent(unquotedValue);
	} catch (_) {
		return unquotedValue;
	}
};

// Characters that need to be escaped when quoted: backslash and double quote
const ESCAPABLE_CHARACTERS = /[\\"]/g;

// Matches anything NOT in the range from space (0x20) to tilde (0x7E)
const NEEDS_ENCODING = /[^\x20-\x7E]/;

// Characters that need quoting or escaping in unquoted values
const SPECIAL_CHARACTERS = /[\s",;\\]/;

export const encodeCookieValue = (value: string): string => {
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
};

// RFC 6265 values, lowercase for ease of use, later capitalized for serialization
export const VALID_SAME_SITE_VALUES = ["strict", "lax", "none"] as const;
export const VALID_PRIORITY_VALUES = ["low", "medium", "high"] as const;

// Helper, internally lowercase values for comparison
export const lowercase = <T extends string>(str: T): Lowercase<T> => {
	return str.toLowerCase() as Lowercase<T>;
};

export const capitalize = <T extends string>(str: T): Capitalize<T> => {
	return (str.charAt(0).toUpperCase() + str.slice(1)) as Capitalize<T>;
};
