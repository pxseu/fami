import { InvalidAttributeError, InvalidNameError } from "./errors";
import {
	COOKIE_SEPARATORS,
	capitalize,
	decodeCookieValue,
	encodeCookieValue,
	formatHttpDate,
	isValidCookieDomain,
	isValidCookieName,
	isValidCookiePath,
	lowercase,
	NAME_VALUE_MATCHER,
	newObject,
	VALID_PRIORITY_VALUES,
	VALID_SAME_SITE_VALUES,
} from "./helpers";
import type { CookieAttributes, Cookies } from "./types";

/**
 * Parses a Cookie header value (multiple cookies from client) into a Cookies object
 *
 * @param cookieHeader The Cookie header value to parse
 * @returns Cookies object with cookie name as key and Cookie object as value
 */
export function parse(cookieHeader: string | null | undefined): Cookies {
	// explicity accept null and undefined since the Cookie header is optional
	if (!cookieHeader || typeof cookieHeader !== "string") {
		return {};
	}

	const cookies = newObject<Cookies>();

	const parts = cookieHeader.split(COOKIE_SEPARATORS);

	for (const part of parts) {
		const nameValueMatch = part.match(NAME_VALUE_MATCHER);
		if (!nameValueMatch) continue;

		const [, name, value] = nameValueMatch;
		const trimmedName = name?.trim();

		if (!trimmedName || !isValidCookieName(trimmedName)) {
			continue;
		}

		if (trimmedName in cookies) {
			// if the cookie already exists, skip it
			continue;
		}

		cookies[trimmedName] = decodeCookieValue((value || "").trim());
	}

	return cookies;
}

/**
 * Serializes a cookie object to a Set-Cookie header value
 *
 * @param cookie The cookie object to serialize
 * @returns Set-Cookie header value string
 */
export function serialize(
	name: string,
	value: string,
	attributes?: CookieAttributes,
): string {
	if (!name || !isValidCookieName(name)) {
		throw new InvalidNameError(name);
	}

	if (attributes?.domain && !isValidCookieDomain(attributes.domain)) {
		throw new InvalidAttributeError("Domain", attributes.domain);
	}

	if (attributes?.path && !isValidCookiePath(attributes.path)) {
		throw new InvalidAttributeError("Path", attributes.path);
	}

	let result = `${name}=${encodeCookieValue(value || "")}`;

	if (attributes?.expires) {
		result += `; Expires=${formatHttpDate(attributes.expires)}`;
	}

	if (typeof attributes?.maxAge === "number" && attributes.maxAge >= 0) {
		result += `; Max-Age=${attributes.maxAge}`;
	}

	if (attributes?.domain) {
		result += `; Domain=${attributes.domain}`;
	}

	if (attributes?.path) {
		result += `; Path=${attributes.path}`;
	}

	if (attributes?.secure) {
		result += "; Secure";
	}

	if (attributes?.httpOnly) {
		result += "; HttpOnly";
	}

	if (attributes?.partitioned) {
		result += "; Partitioned";
	}

	if (attributes?.priority) {
		const lower = lowercase(attributes.priority);

		if (!VALID_PRIORITY_VALUES.includes(lower)) {
			throw new InvalidAttributeError("priority", lower, VALID_PRIORITY_VALUES);
		}

		result += `; Priority=${capitalize(lower)}`;
	}

	if (attributes?.sameSite) {
		const lower = lowercase(attributes.sameSite);

		if (!VALID_SAME_SITE_VALUES.includes(lower)) {
			throw new InvalidAttributeError(
				"SameSite",
				lower,
				VALID_SAME_SITE_VALUES,
			);
		}

		result += `; SameSite=${capitalize(lower)}`;
	}

	return result;
}
