import type { VALID_PRIORITY_VALUES, VALID_SAME_SITE_VALUES } from "./helpers";

/**
 * Primitive cookie values, that can be used without any special serializing.
 */
export type CookieValue = string | number | boolean;

export type CookieAttributes = Partial<{
	/**
	 * The date and time after which the cookie will be considered expired
	 * If both `expires` and `maxAge` are set, `maxAge` has precedence.
	 * Both should **NOT** be used together, but if they are they should point the same value.
	 *
	 * @see https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Set-Cookie#expiresdate
	 */
	expires: Date;
	/**
	 * The maximum age of the cookie in seconds
	 * If both `expires` and `maxAge` are set, `maxAge` has precedence.
	 * Both should **NOT** be used together, but if they are they should point the same value.
	 *
	 * @see https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Set-Cookie#max-agenumber
	 */
	maxAge: number;
	/**
	 * The domain for which the cookie is valid
	 *
	 * @see https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Set-Cookie#domaindomain-value
	 */
	domain: string;
	/**
	 * The path for which the cookie is valid
	 *
	 * @see https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Set-Cookie#pathpath-value
	 */
	path: string;
	/**
	 * Whether the cookie is only sent over HTTPS
	 *
	 * @see https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Set-Cookie#secure
	 */
	secure: boolean;
	/**
	 * Whether the cookie is http only (not accessible to JavaScript)
	 *
	 * @see https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Set-Cookie#httponly
	 */
	httpOnly: boolean;
	/**
	 * The SameSite attribute for the cookie
	 *
	 * @see https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Set-Cookie#samesitesamesite-value
	 */
	sameSite: (typeof VALID_SAME_SITE_VALUES)[number];
	/**
	 *  Enables Partitioned Cookies (CHIPS). This is not available in all browsers yet.
	 *
	 *  @see https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Set-Cookie#partitioned
	 *  @see https://developer.mozilla.org/docs/Web/Privacy/Guides/Privacy_sandbox/Partitioned_cookies
	 */
	partitioned: boolean;
	/**
	 *  Priority of the cookie. This will be used to determine the eviction of the cookie when the storage limit is reached.
	 *
	 *  @see https://issues.chromium.org/issues/41007714
	 */
	priority: (typeof VALID_PRIORITY_VALUES)[number];
}>;

/**
 * Cookies object with cookie name as key and value as string
 */
export type Cookies = {
	[key: string]: string;
};
