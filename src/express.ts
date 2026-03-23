import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
	Fami,
	type FamiCookies,
	type FamiInput,
	type PromiseIfSecret,
} from "./fami";
import type { CookieAttributes, CookieValue } from "./types";

export type ExpressRequestStub = { headers: { cookie?: string } };
export type ExpressResponseStub = {
	append(name: string, value: string): unknown;
	writeHead(...args: unknown[]): unknown;
};
export type NextFunctionStub = (err?: unknown) => void;

/**
 * Properties added to the request object by the Fami middleware
 */
export type FamiRequest<
	CookieName extends string,
	Definition extends FamiInput<CookieName>,
> = {
	/**
	 * The Fami instance that is used to manage cookie definitions and serialize/parse/delete cookies
	 */
	readonly fami: Fami<CookieName, Definition>;
	/**
	 * Lazy parsed cookies from the request header.
	 * Only parsed when first accessed and cached for subsequent reads.
	 */
	readonly cookies: ReturnType<Fami<CookieName, Definition>["parse"]>;
};

/**
 * Properties added to the response object by the Fami middleware
 */
export type FamiResponse<
	CookieName extends string,
	Definition extends FamiInput<CookieName>,
> = {
	/**
	 * The cookie jar containing all pending Set-Cookie header values.
	 * Keyed by cookie name -- only the last operation per cookie is kept.
	 * Inspect this before the response is sent to see what cookies will be set.
	 */
	readonly cookieJar: ReadonlyMap<
		CookieName,
		PromiseIfSecret<CookieName, Definition>
	>;
	/**
	 * Create a Set-Cookie header value with the given name, value and attributes, and add it to the cookie jar.
	 * The jar is flushed to Set-Cookie headers when the response is sent.
	 */
	/**
	 *  Create a Set-Cookie header value that with the given name, value and attributes, and add it to the response header
	 */
	setCookie<Name extends CookieName>(
		name: Name,
		value: CookieValue,
		attributes?: CookieAttributes,
	): PromiseIfSecret<Name, Definition, void>;
	/**
	 *  Create a Set-Cookie header value that removes the cookie from the client (set maxAge to 0 and expires to `new Date(0)`)
	 */
	deleteCookie<Name extends CookieName>(
		name: Name,
	): PromiseIfSecret<Name, Definition, void>;
};

/**
 * The Express adapter interface returned by `fami`.
 * Provides a middleware for runtime augmentation and a handler wrapper for type narrowing.
 */
export type FamiExpress<
	CookieName extends string,
	Definition extends FamiInput<CookieName>,
> = {
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
			req: Omit<Request, keyof FamiRequest<CookieName, Definition>> &
				FamiRequest<CookieName, Definition>,
			res: Omit<Response, keyof FamiResponse<CookieName, Definition>> &
				FamiResponse<CookieName, Definition>,
			next: NextFunction,
		) => void,
	): RequestHandler;
};

function createRequest<
	CookieName extends string,
	Definition extends FamiInput<CookieName>,
>(req: ExpressRequestStub, fami: Fami<CookieName, Definition>) {
	let lazyCookies: FamiCookies<CookieName, Definition> | undefined;

	Object.defineProperties(req, {
		fami: {
			get: () => fami,
			configurable: false,
		},
		cookies: {
			get() {
				if (lazyCookies) return lazyCookies;
				lazyCookies = Object.freeze(fami.parse(req.headers.cookie));
				return lazyCookies;
			},
			configurable: false,
		},
	});
}

function createResponse<
	CookieName extends string,
	Definition extends FamiInput<CookieName>,
>(res: ExpressResponseStub, fami: Fami<CookieName, Definition>) {
	const jar = new Map<CookieName, PromiseIfSecret<CookieName, Definition>>();
	const originalWriteHead = res.writeHead;

	Object.defineProperties(res, {
		setCookie: {
			value: (...args: Parameters<typeof fami.serialize>) => {
				jar.set(args[0], fami.serialize(...args));
			},
			configurable: false,
		},
		deleteCookie: {
			value: (...args: Parameters<typeof fami.delete>) => {
				jar.set(args[0], fami.delete(...args));
			},
			configurable: false,
		},
		cookieJar: {
			get: () => jar,
			configurable: false,
		},
		writeHead: {
			value: function (this: ExpressResponseStub, ...args: unknown[]) {
				const promises = [];

				for (const value of jar.values()) {
					if (value instanceof Promise) {
						promises.push(
							value.then((h) => 
								res.append("Set-Cookie", h)
							),
						);
					} else {
						res.append("Set-Cookie", value);
					}
				}

				if (promises.length > 0) {
					return Promise.all(promises).then(() =>
						originalWriteHead.apply(this, args),
					);
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
 * import { fami } from "fami/express";
 *
 * const app = express();
 * const f = fami({ session: {} });
 *
 * app.use(f.middleware());
 *
 * app.get("/", f.handler((req, res) => {
 *   req.cookies.session;              // autocomplete + type-safe
 *   res.setCookie("session", "val");  // typed cookie name
 *   res.json(req.cookies);
 * }));
 * ```
 */
export function fami<
	CookieName extends string,
	Definition extends FamiInput<CookieName>,
>(
	cookieInit: FamiInput<CookieName> | Fami<CookieName, Definition>,
): FamiExpress<CookieName, Definition> {
	const fami = cookieInit instanceof Fami ? cookieInit : new Fami(cookieInit);

	return {
		middleware() {
			return (
				req: ExpressRequestStub,
				res: ExpressResponseStub,
				next: NextFunctionStub,
			) => {
				createRequest(req, fami);
				createResponse(res, fami);
				next();
			};
		},

		handler: (fn) => fn as unknown as RequestHandler,
	};
}
