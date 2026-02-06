import type { NextFunction, Request, RequestHandler, Response } from "express";
import { type CookieInit, Fami } from "./fami";

export type ExpressRequestStub = { headers: { cookie?: string } };
export type ExpressResponseStub = {
	append(name: string, value: string): unknown;
	writeHead(...args: unknown[]): unknown;
};
export type NextFunctionStub = (err?: unknown) => void;

/**
 * Properties added to the request object by the Fami middleware
 */
export type FamiRequest<CookieName extends string> = {
	/**
	 * The Fami instance that is used to manage cookie definitions and serialize/parse/delete cookies
	 */
	readonly fami: Fami<CookieName>;
	/**
	 * Lazy parsed cookies from the request header.
	 * Only parsed when first accessed and cached for subsequent reads.
	 */
	readonly cookies: Record<CookieName, string | undefined>;
};

/**
 * Properties added to the response object by the Fami middleware
 */
export type FamiResponse<CookieName extends string> = {
	/**
	 * The cookie jar containing all pending Set-Cookie header values.
	 * Keyed by cookie name -- only the last operation per cookie is kept.
	 * Inspect this before the response is sent to see what cookies will be set.
	 */
	readonly cookieJar: ReadonlyMap<CookieName, string>;
	/**
	 * Create a Set-Cookie header value with the given name, value and attributes, and add it to the cookie jar.
	 * The jar is flushed to Set-Cookie headers when the response is sent.
	 */
	setCookie(...args: Parameters<Fami<CookieName>["serialize"]>): void;
	/**
	 * Create a Set-Cookie header value that removes the cookie from the client (set maxAge to 0 and expires to `new Date(0)`).
	 * The deletion is added to the cookie jar and flushed when the response is sent.
	 */
	deleteCookie(...args: Parameters<Fami<CookieName>["delete"]>): void;
};

/**
 * The Express adapter interface returned by `createFami`.
 * Provides a middleware for runtime augmentation and a handler wrapper for type narrowing.
 */
export type FamiExpress<CookieName extends string> = {
	/**
	 * Express middleware that augments `req` and `res` with Fami cookie management.
	 * Must be applied via `app.use()` before routes that use `fami.handler()`.
	 *
	 * Adds to `req`: `fami` (Fami instance), `cookies` (lazy parsed cookies)
	 * Adds to `res`: `setCookie()`, `deleteCookie()`, `cookieJar` (pending cookies)
	 *
	 * The middleware patches `res.writeHead` to flush the cookie jar to `Set-Cookie` headers
	 * right before the response headers are sent.
	 */
	middleware(): (
		req: ExpressRequestStub,
		res: ExpressResponseStub,
		next: NextFunctionStub,
	) => void;

	/**
	 * Type-safe handler wrapper. The middleware must be applied first via `app.use()`.
	 * This is an identity function at runtime (zero cost) -- it only narrows TypeScript types
	 * so that `req.cookies`, `req.fami`, `res.setCookie()`, `res.deleteCookie()` and `res.cookieJar`
	 * are properly typed, while preserving full Express `Request` and `Response` autocomplete.
	 *
	 * @example
	 * ```ts
	 * app.get("/", fami.handler((req, res) => {
	 *   req.cookies.session;              // autocomplete + type-safe
	 *   res.setCookie("session", "val");  // typed cookie name
	 *   res.json(req.cookies);            // full Express autocomplete
	 * }));
	 * ```
	 */
	handler(
		fn: (
			req: Omit<Request, keyof FamiRequest<CookieName>> &
				FamiRequest<CookieName>,
			res: Omit<Response, keyof FamiResponse<CookieName>> &
				FamiResponse<CookieName>,
			next: NextFunction,
		) => void,
	): RequestHandler;
};

function augmentRequest<CookieName extends string>(
	req: ExpressRequestStub,
	fami: Fami<CookieName>,
) {
	let lazyCookies: Record<CookieName, string | undefined> | undefined;

	Object.defineProperties(req, {
		fami: {
			get: () => fami,
			configurable: true,
		},
		cookies: {
			get() {
				if (lazyCookies) return lazyCookies;
				lazyCookies = Object.freeze(fami.parse(req.headers.cookie));
				return lazyCookies;
			},
			configurable: true,
		},
	});
}

function augmentResponse<CookieName extends string>(
	res: ExpressResponseStub,
	fami: Fami<CookieName>,
) {
	const jar = new Map<CookieName, string>();
	const originalWriteHead = res.writeHead;

	Object.defineProperties(res, {
		setCookie: {
			value: (...args: Parameters<typeof fami.serialize>) => {
				jar.set(args[0], fami.serialize(...args));
			},
			configurable: true,
		},
		deleteCookie: {
			value: (...args: Parameters<typeof fami.delete>) => {
				jar.set(args[0], fami.delete(...args));
			},
			configurable: true,
		},
		cookieJar: {
			get: () => jar,
			configurable: true,
		},
		writeHead: {
			value: function (this: ExpressResponseStub, ...args: unknown[]) {
				for (const value of jar.values()) {
					res.append("Set-Cookie", value);
				}
				return originalWriteHead.apply(this, args);
			},
			configurable: true,
		},
	});
}

/**
 * Creates an Express adapter for Fami with type-safe cookie management.
 *
 * Returns an object with:
 * - `middleware()` -- Express middleware to apply via `app.use()`
 * - `handler()` -- Type-safe handler wrapper for route handlers
 *
 * @param cookieInit The cookie definitions to initialize the Fami instance with, or an existing Fami instance
 * @returns A `FamiExpress` adapter
 *
 * @example
 * ```ts
 * import express from "express";
 * import { createFami } from "fami/express";
 *
 * const app = express();
 * const fami = createFami(["session"]);
 *
 * app.use(fami.middleware());
 *
 * app.get("/", fami.handler((req, res) => {
 *   req.cookies.session;              // autocomplete + type-safe
 *   res.setCookie("session", "val");  // typed cookie name
 *   res.json(req.cookies);
 * }));
 * ```
 */
export function createFami<CookieName extends string>(
	cookieInit: readonly CookieInit<CookieName>[] | Fami<CookieName>,
): FamiExpress<CookieName> {
	const fami = cookieInit instanceof Fami ? cookieInit : new Fami(cookieInit);

	return {
		middleware() {
			return (
				req: ExpressRequestStub,
				res: ExpressResponseStub,
				next: NextFunctionStub,
			) => {
				augmentRequest(req, fami);
				augmentResponse(res, fami);
				next();
			};
		},

		// Identity function -- the cast is safe because the middleware
		// has already augmented req/res at runtime.
		handler: (fn) => fn as unknown as RequestHandler,
	};
}
