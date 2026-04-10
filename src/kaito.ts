import { Fami, type FamiInput, type PromiseIfSecret } from "./fami";
import type { CookieAttributes, CookieValue } from "./types";

type NoOverlap<T, U> = {
	[K in keyof T & keyof U]: never;
};

export type KaitoRequestStub = { headers: Headers };
export type KaitoHeadStub = { headers: Headers };

export interface FamiContext<
	CookieName extends string,
	Defs extends FamiInput<CookieName>,
> {
	/**
	 *  The Fami instance that is used to manage cookie definitions and serialize/parse/delete cookies
	 */
	readonly fami: Fami<CookieName, Defs>;
	/**
	 *  Lazy parsed cookies from the request header.
	 */
	readonly cookies: ReturnType<Fami<CookieName, Defs>["parse"]>;
	/**
	 *  Create a Set-Cookie header value that with the given name, value and attributes, and add it to the response header
	 */
	setCookie<Name extends CookieName>(
		name: Name,
		value: CookieValue,
		attributes?: CookieAttributes,
	): PromiseIfSecret<Name, Defs, void>;
	/**
	 *  Create a Set-Cookie header value that removes the cookie from the client (set maxAge to 0 and expires to `new Date(0)`)
	 */
	deleteCookie<Name extends CookieName>(
		name: Name,
	): PromiseIfSecret<Name, Defs, void>;
}

export type FamiPipeInput<
	C,
	Names extends string,
	Defs extends FamiInput<Names>,
> = C extends null | undefined ? C : NoOverlap<C, FamiContext<Names, Defs>> & C;

export type FamiPipeOutput<
	C,
	Names extends string,
	Defs extends FamiInput<Names>,
> = C extends null | undefined
	? FamiContext<Names, Defs>
	: C & FamiContext<Names, Defs>;

export type FamiPipeContext<
	Names extends string,
	Defs extends FamiInput<Names>,
> = <C, P>(
	context: FamiPipeInput<C, Names, Defs>,
	params: P,
	req: KaitoRequestStub,
	head: KaitoHeadStub,
) => FamiPipeOutput<C, Names, Defs>;

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
export function fami<
	CookieName extends string,
	Defs extends FamiInput<CookieName>,
>(
	cookieInit: (FamiInput<CookieName> & Defs) | Fami<CookieName, Defs>,
): FamiPipeContext<CookieName, Defs> {
	const f = cookieInit instanceof Fami ? cookieInit : new Fami(cookieInit);

	return <C, P>(
		context: FamiPipeInput<C, CookieName, Defs>,
		_params: P,
		req: KaitoRequestStub,
		head: KaitoHeadStub,
	): FamiPipeOutput<C, CookieName, Defs> => {
		// i know this looks so ugly but for now it's the only way to have proper typings for setCookie and deleteCookie
		function setCookie<Name extends CookieName>(
			...args: Parameters<Fami<Name, Defs>["serialize"]>
		): PromiseIfSecret<Name, Defs, void>;
		function setCookie(
			name: CookieName,
			value: CookieValue,
			attributes?: CookieAttributes,
		) {
			const header = f.serialize(name, value, attributes);

			if (header instanceof Promise) {
				return header.then((h) => {
					head.headers.append("Set-Cookie", h);
				});
			}

			return head.headers.append("Set-Cookie", header);
		}

		function deleteCookie<Name extends CookieName>(
			...args: Parameters<Fami<Name, Defs>["delete"]>
		): PromiseIfSecret<Name, Defs, void>;
		function deleteCookie(name: CookieName) {
			const header = f.delete(name);

			if (header instanceof Promise) {
				return header.then((h) => {
					head.headers.append("Set-Cookie", h);
				});
			}

			return head.headers.append("Set-Cookie", header);
		}

		function buildContext<C>(
			input: FamiPipeInput<C, CookieName, Defs>,
		): FamiPipeOutput<C, CookieName, Defs>;
		function buildContext(input: object | null | undefined) {
			return {
				...(input ?? {}),
				get fami() {
					return f;
				},
				get cookies() {
					const cookies = Object.freeze(f.parse(req.headers.get("Cookie")));

					Object.defineProperties(this, {
						cookies: {
							value: cookies,
							enumerable: true,
							configurable: true,
						},
					});

					return cookies;
				},
				setCookie,
				deleteCookie,
			};
		}

		return buildContext(context);
	};
}
