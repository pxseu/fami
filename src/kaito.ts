import { type CookieInit, Fami } from "./fami";

type MaybePromise<T> = T | Promise<T>;

type NoOverlap<T, U> = {
	[K in keyof T & keyof U]: never;
};

type GetContext<KaitoRequestStub, KaitoHeadStub, Return extends object> = (
	req: KaitoRequestStub,
	head: KaitoHeadStub,
) => MaybePromise<Return>;

export type FamiContext<CookieName extends string> = {
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
};

/**
 * A Kaito context wrapper that includes the Fami instance and cookie management methods
 * You should not call this function directly, simply wrap your current context function with it.
 */
export type FamiContextWrapper<CookieName extends string> = <
	KaitoRequestStub extends { headers: Headers },
	KaitoHeadStub extends { headers: Headers },
	Return extends object & NoOverlap<Return, FamiContext<CookieName>>,
>(
	getContext: GetContext<KaitoRequestStub, KaitoHeadStub, Return>,
) => (
	req: KaitoRequestStub,
	head: KaitoHeadStub,
) => MaybePromise<Return & FamiContext<CookieName>>;

function createFamiContext<CookieName extends string, Return extends object>(
	fami: Fami<CookieName>,
	req: { headers: Headers },
	head: { headers: Headers },
	context: Return,
): Return & FamiContext<CookieName> {
	let lazyCookies: Record<CookieName, string | undefined> | undefined;

	return {
		...context,
		get fami() {
			return fami;
		},
		get cookies() {
			if (lazyCookies) return lazyCookies;
			lazyCookies = Object.freeze(fami.parse(req.headers.get("Cookie")));
			return lazyCookies;
		},
		setCookie(...args: Parameters<typeof fami.serialize>) {
			head.headers.append("Set-Cookie", fami.serialize(...args));
		},
		deleteCookie(...args: Parameters<typeof fami.delete>) {
			head.headers.append("Set-Cookie", fami.delete(...args));
		},
	};
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
 * const context = createFami(["session"]);
 *
 * const kaito = create({
 *   getContext: context((req, head) => {
 *     // your usual context function
 *     // it will be merged with the Fami context
 *   }),
 * });
 * ```
 */
export function createFami<CookieName extends string>(
	cookieInit: readonly CookieInit<CookieName>[] | Fami<CookieName>,
): FamiContextWrapper<CookieName> {
	const fami = cookieInit instanceof Fami ? cookieInit : new Fami(cookieInit);

	return <
		KaitoRequestStub extends { headers: Headers },
		KaitoHeadStub extends { headers: Headers },
		Return extends object,
	>(
		getContext: GetContext<KaitoRequestStub, KaitoHeadStub, Return>,
	): ((
		req: KaitoRequestStub,
		head: KaitoHeadStub,
	) => MaybePromise<Return & FamiContext<CookieName>>) => {
		return (req: KaitoRequestStub, head: KaitoHeadStub) => {
			const userContext = getContext(req, head);

			if (userContext instanceof Promise) {
				return userContext.then((context) =>
					createFamiContext(fami, req, head, context),
				);
			}

			return createFamiContext(fami, req, head, userContext);
		};
	};
}
