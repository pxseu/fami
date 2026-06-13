import {
	COOKIE_SEPARATORS,
	capitalize,
	decodeCookieValue,
	encodeCookieValue,
	formatHttpDate,
	isValidCookieName,
	lowercase,
	NAME_VALUE_MATCHER,
	newObject,
	normalizeCookieHeader,
	validateAttributes,
} from "./helpers";
import type {
	CookieAttributes,
	CookieHeader,
	Cookies,
	CookieValue,
} from "./types";

/**
 * Parses a Cookie header value (multiple cookies from client) into a Cookies object
 *
 * @param cookieHeader The Cookie header value to parse
 * @returns Cookies object with cookie name as key and decoded value
 */
export function parse(cookieHeader: CookieHeader): Cookies {
	const header = normalizeCookieHeader(cookieHeader);

	if (!header) {
		return {};
	}

	const cookies = newObject<Cookies>();

	const parts = header.split(COOKIE_SEPARATORS);

	for (const part of parts) {
		const nameValueMatch = part.match(NAME_VALUE_MATCHER);
		if (!nameValueMatch) continue;

		const [, name, value] = nameValueMatch;

		const trimmedName = name?.trim();
		if (!isValidCookieName(trimmedName)) continue;

		// first occurrence wins
		if (trimmedName in cookies) continue;

		cookies[trimmedName] = decodeCookieValue((value || "").trim());
	}

	return cookies;
}

/**
 * Serializes a cookie name, value, and optional attributes to a Set-Cookie header value.
 *
 * @param name The cookie name
 * @param value The cookie value
 * @param attributes Optional Set-Cookie attributes
 * @returns Set-Cookie header value string
 */
export function serialize(
	name: string,
	value: CookieValue,
	attributes?: CookieAttributes,
): string {
	const { secure, path } = validateAttributes(name, attributes);

	let result = `${name}=${encodeCookieValue(String(value))}`;

	if (attributes?.expires) {
		result += `; Expires=${formatHttpDate(attributes.expires)}`;
	}

	if (attributes?.maxAge !== undefined) {
		result += `; Max-Age=${attributes.maxAge}`;
	}

	if (attributes?.domain) {
		result += `; Domain=${attributes.domain}`;
	}

	if (path) {
		result += `; Path=${path}`;
	}

	if (secure) {
		result += "; Secure";
	}

	if (attributes?.httpOnly) {
		result += "; HttpOnly";
	}

	if (attributes?.partitioned) {
		result += "; Partitioned";
	}

	if (attributes?.priority) {
		result += `; Priority=${capitalize(lowercase(attributes.priority))}`;
	}

	if (attributes?.sameSite) {
		result += `; SameSite=${capitalize(lowercase(attributes.sameSite))}`;
	}

	return result;
}
