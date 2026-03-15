import { Fami, type FamiInput } from "./fami";

type NoOverlap<T, U> = {
	[K in keyof T & keyof U]: never;
};

export type KaitoRequestStub = { headers: Headers };
export type KaitoHeadStub = { headers: Headers };

export interface FamiContext<CookieName extends string> {
	/**
	 *  The Fami instance that is used to manage cookie definitions and serialize/parse/delete cookies
	 */
	readonly fami: Fami<CookieName>;
	/**
	 *  Lazy parsed cookies from the request header.
	 */
	readonly cookies: ReturnType<Fami<CookieName>["parse"]>;
	/**
	 *  Create a Set-Cookie header value that with the given name, value and attributes, and add it to the response header
	 */
	setCookie(...args: Parameters<Fami<CookieName>["serialize"]>): void;
	/**
	 *  Create a Set-Cookie header value that removes the cookie from the client (set maxAge to 0 and expires to `new Date(0)`)
	 */
	deleteCookie(...args: Parameters<Fami<CookieName>["delete"]>): void;
}

export interface FamiPipeContext<Names extends string> {
	<C, P>(
		context: NoOverlap<C, FamiContext<Names>> & C,
		params: P,
		req: KaitoRequestStub,
		head: KaitoHeadStub,
	): C & FamiContext<Names>;

	<C, P>(
		context: C extends null | undefined ? C : never,
		params: P,
		req: KaitoRequestStub,
		head: KaitoHeadStub,
	): FamiContext<Names>;
}

/**
 * Creates a Kaito context wrapper that includes the Fami instance and cookie management methods.
 * You should not call this function directly, simply wrap your current context function with it.
 *
 * @param cookieInit The cookie definitions to initialize the Fami instance with
 * @returns A Kaito context wrapper
 *
 * @example
 * ```ts
 * import { create } from "@kaito-http/core";
 * import { fami } from "fami/kaito";
 *
 * const kaito = create({
 *   getContext: (req, head) => {
 *     // your usual context function
 *     // it will be merged with the Fami context
 *   },
 * }).pipe(
 *   fami({
 *     session: { secure: true },
 *     tracking: {},
 *   }),
 * );
 * ```
 *
 * @see {@link Fami} for more details on cookie definitions and management
 */
export function fami<Names extends string>(
	cookieInit: FamiInput<Names> | Fami<Names>,
): FamiPipeContext<Names> {
	const fami = cookieInit instanceof Fami ? cookieInit : new Fami(cookieInit);

	return <C, P>(
		context: NoOverlap<C, FamiContext<Names>> & C,
		params: P,
		req: KaitoRequestStub,
		head: KaitoHeadStub,
	): C & FamiContext<Names> => {
		return {
			...(context ?? {}),
			get fami() {
				return fami;
			},
			get cookies() {
				const cookies = Object.freeze(fami.parse(req.headers.get("Cookie")));
				Object.defineProperties(this, {
					cookies: {
						value: cookies,
						enumerable: true,
						configurable: true,
					},
				});
				return cookies;
			},
			setCookie(...args: Parameters<typeof fami.serialize>) {
				head.headers.append("Set-Cookie", fami.serialize(...args));
			},
			deleteCookie(...args: Parameters<typeof fami.delete>) {
				head.headers.append("Set-Cookie", fami.delete(...args));
			},
		};
	};
}
