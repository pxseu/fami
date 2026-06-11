import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
	Fami,
	type FamiCookies,
	type FamiInput,
	type PromiseIfSecret,
} from "./fami";
import type { CookieAttributes, CookieValue, MaybePromise } from "./types";

export type ExpressRequestStub = { headers: { cookie?: string | string[] } };
export type ExpressResponseStub = {
	append(name: string, value: string): unknown;
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
 * Properties added to the response object by the Fami middleware.
 *
 * Both methods append a `Set-Cookie` header immediately, returning a
 * `Promise<void>` for signed cookies — await it before sending the response.
 */
export type FamiResponse<
	CookieName extends string,
	Definition extends FamiInput<CookieName>,
> = {
	/**
	 * Serialize a cookie with the given name, value, and attributes, then
	 * append the resulting `Set-Cookie` header to the response.
	 *
	 * For signed cookies, returns a `Promise<void>` — await it before sending.
	 */
	setCookie<Name extends CookieName>(
		name: Name,
		value: CookieValue,
		attributes?: CookieAttributes,
	): PromiseIfSecret<Name, Definition, void>;
	/**
	 * Append a `Set-Cookie` header that removes the cookie from the client
	 * (sets `Max-Age=0` and `Expires=new Date(0)`).
	 *
	 * For signed cookies, returns a `Promise<void>` — await it before sending.
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
	 * Adds to `res`: `setCookie()`, `deleteCookie()`
	 */
	middleware(): (
		req: ExpressRequestStub,
		res: ExpressResponseStub,
		next: NextFunctionStub,
	) => void;

	/**
	 * Type-safe handler wrapper. The middleware must be applied first via `app.use()`.
	 * This is an identity function at runtime (zero cost) -- it only narrows TypeScript types
	 * so that `req.cookies`, `req.fami`, `res.setCookie()`, and `res.deleteCookie()`
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

	install(req, {
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
	function appendHeader(header: MaybePromise<string>): MaybePromise<void> {
		if (header instanceof Promise) {
			return header.then((h) => {
				res.append("Set-Cookie", h);
			});
		}

		res.append("Set-Cookie", header);
	}

	install(res, {
		setCookie: {
			value: (...args: Parameters<typeof fami.serialize>) =>
				appendHeader(fami.serialize(...args)),
			configurable: false,
		},
		deleteCookie: {
			value: (...args: Parameters<typeof fami.delete>) =>
				appendHeader(fami.delete(...args)),
			configurable: false,
		},
	});
}

function install(target: object, properties: PropertyDescriptorMap) {
	for (const name of Object.keys(properties)) {
		if (Object.hasOwn(target, name)) {
			throw new Error(`Fami Express middleware cannot install ${name}`);
		}
	}

	Object.defineProperties(target, properties);
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
	cookieInit:
		| (FamiInput<CookieName> & Definition)
		| Fami<CookieName, Definition>,
): FamiExpress<CookieName, Definition> {
	const f = cookieInit instanceof Fami ? cookieInit : new Fami(cookieInit);

	return {
		middleware() {
			return (
				req: ExpressRequestStub,
				res: ExpressResponseStub,
				next: NextFunctionStub,
			) => {
				createRequest(req, f);
				createResponse(res, f);

				next();
			};
		},

		handler: (fn) => fn as unknown as RequestHandler,
	};
}
