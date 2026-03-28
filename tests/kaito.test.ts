import { describe, expect, test, vi } from "bun:test";
import { Fami, type FamiInput } from "../src/fami";
import { fami as createFami } from "../src/kaito";

function mockReq(cookie?: string) {
	const headers = new Headers();
	if (cookie) headers.set("Cookie", cookie);
	return { headers };
}

function mockHead() {
	return { headers: new Headers() };
}

function applyContext<
	CookieName extends string,
	Defs extends FamiInput<CookieName>,
>(
	wrapper: ReturnType<typeof createFami<CookieName, Defs>>,
	req = mockReq(),
	head = mockHead(),
) {
	const context = wrapper({}, {}, req, head);

	return { context, req, head };
}

describe("kaito - createFami", () => {
	describe("context wrapper creation", () => {
		test("creates wrapper that exposes fami instance", () => {
			const wrapper = createFami({ session: {}, tracking: {} });
			const req = mockReq();
			const head = mockHead();
			const context = wrapper({}, {}, req, head);

			expect(context.fami).toBeDefined();
			expect(context.fami.getNames()).toEqual(["session", "tracking"]);
		});

		test("merges user context with fami context", () => {
			const wrapper = createFami({ session: {} });
			const req = mockReq();
			const head = mockHead();
			const context = wrapper(
				{
					userId: 123,
					isAdmin: true,
				},
				{},
				req,
				head,
			);

			// User context preserved
			expect(context.userId).toBe(123);
			expect(context.isAdmin).toBe(true);

			// Fami context added
			expect(context.fami).toBeDefined();
			expect(context.cookies).toBeDefined();
			expect(context.setCookie).toBeDefined();
			expect(context.deleteCookie).toBeDefined();
		});

		test("works with empty user context", () => {
			const wrapper = createFami({ session: {} });
			const { context } = applyContext(wrapper);

			expect(context.fami).toBeDefined();
			expect(context.cookies).toBeDefined();
			expect(context.setCookie).toBeDefined();
			expect(context.deleteCookie).toBeDefined();
		});

		test("fami getter always returns same instance", () => {
			const wrapper = createFami({ session: {} });
			const { context } = applyContext(wrapper);

			expect(context.fami).toBe(context.fami);
		});

		test("wrapper works with kaito that calls getContext", () => {
			const wrapper = createFami({ session: {} });

			function mockKaito<Context>(config: {
				getContext: (
					prev: object,
					params: unknown,
					req: { headers: Headers; special: "test" },
					head: { headers: Headers },
				) => Context;
			}) {
				const req = { headers: new Headers(), special: "test" } as const;
				const head = mockHead();
				return config.getContext({}, {}, req, head);
			}

			const context = mockKaito({
				getContext: wrapper,
			});

			expect(context.fami).toBeDefined();
			expect(context.cookies).toBeDefined();
		});

		test("wrapper works with fami instance", () => {
			const fami = new Fami({ session: {}, tracking: {} });
			const wrapper = createFami(fami);
			const { context } = applyContext(wrapper);

			expect(context.fami).toBe(fami);
			expect(context.cookies).toEqual({
				session: undefined,
				tracking: undefined,
			});
		});
	});

	describe("lazy cookies getter", () => {
		test("does not parse cookies until accessed", () => {
			const wrapper = createFami({ session: {}, tracking: {} });

			const headers = new Headers({
				Cookie: "session=abc123; tracking=xyz789",
			});
			const getSpy = vi.spyOn(headers, "get");

			const req = { headers };
			const head = mockHead();
			const context = wrapper({}, {}, req, head);

			expect(getSpy).not.toHaveBeenCalled();

			const cookies = context.cookies;

			expect(getSpy).toHaveBeenCalledTimes(1);
			expect(getSpy).toHaveBeenCalledWith("Cookie");
			expect(cookies).toEqual({
				session: "abc123",
				tracking: "xyz789",
			});

			getSpy.mockRestore();
		});

		test("caches parsed cookies (returns same reference)", () => {
			const wrapper = createFami({ session: {} });

			const headers = new Headers({
				Cookie: "session=abc123",
			});
			const getSpy = vi.spyOn(headers, "get");

			const req = { headers };
			const head = mockHead();
			const context = wrapper({}, {}, req, head);

			// First access
			const cookies1 = context.cookies;
			expect(getSpy).toHaveBeenCalledTimes(1);

			// Second access - should not call get again
			const cookies2 = context.cookies;
			expect(getSpy).toHaveBeenCalledTimes(1);

			// Third access - still should not call get again
			const cookies3 = context.cookies;
			expect(getSpy).toHaveBeenCalledTimes(1);

			// All references should be the same
			expect(cookies1).toBe(cookies2);
			expect(cookies2).toBe(cookies3);

			getSpy.mockRestore();
		});

		test("returns frozen object", () => {
			const wrapper = createFami({ session: {} });
			const { context } = applyContext(wrapper, mockReq("session=abc123"));

			expect(Object.isFrozen(context.cookies)).toBe(true);
		});

		test("returns all parsed cookies in multiple headers", () => {
			const wrapper = createFami({ session: {}, tracking: {}, testing: {} });

			const req = mockReq();
			// these will get combined once the internal .get("Cookie") is called
			req.headers.append("Cookie", "session=abc123; testing=123");
			req.headers.append("Cookie", "tracking=xyz789");

			const { context } = applyContext(wrapper, req);

			expect(context.cookies).toEqual({
				session: "abc123",
				tracking: "xyz789",
				testing: "123",
			});
		});
	});

	describe("setCookie method", () => {
		test("returns a promise for signed cookies", async () => {
			const wrapper = createFami({
				session: {
					httpOnly: true,
					secret: "super-secret",
				},
			});
			const { context, head } = applyContext(wrapper);

			const result = context.setCookie("session", "new_value");

			expect(result).toBeInstanceOf(Promise);
			await result;

			const setCookieHeader = head.headers.get("Set-Cookie");
			expect(setCookieHeader).toStartWith("session=new_value.");
			expect(setCookieHeader).toContain("; HttpOnly");
		});

		test("appends Set-Cookie header to response", () => {
			const wrapper = createFami({ session: {} });
			const { context, head } = applyContext(wrapper);

			context.setCookie("session", "new_value");

			expect(head.headers.get("Set-Cookie")).toBe("session=new_value");
		});

		test("delegates to fami.serialize with arguments", () => {
			const wrapper = createFami({ session: {} });
			const { context, head } = applyContext(wrapper);

			context.setCookie("session", "value", {
				path: "/",
				maxAge: 3600,
			});

			const setCookieHeader = head.headers.get("Set-Cookie");
			expect(setCookieHeader).toStartWith("session=value;");
			expect(setCookieHeader).toContain("Path=/");
			expect(setCookieHeader).toContain("Max-Age=3600");
		});

		test("appends multiple Set-Cookie headers", () => {
			const wrapper = createFami({ session: {}, tracking: {} });
			const { context, head } = applyContext(wrapper);

			context.setCookie("session", "session_value");
			context.setCookie("tracking", "tracking_value");

			const setCookieHeaders = head.headers.getSetCookie();
			expect(setCookieHeaders).toHaveLength(2);
			expect(setCookieHeaders[0]).toBe("session=session_value");
			expect(setCookieHeaders[1]).toBe("tracking=tracking_value");
		});
	});

	describe("deleteCookie method", () => {
		test("returns a promise for signed cookie deletions", async () => {
			const wrapper = createFami({
				session: {
					path: "/",
					secret: "super-secret",
				},
			});
			const { context, head } = applyContext(wrapper);

			const result = context.deleteCookie("session");

			expect(result).toBeInstanceOf(Promise);
			await result;

			const setCookieHeader = head.headers.get("Set-Cookie");
			expect(setCookieHeader).toStartWith("session=;");
			expect(setCookieHeader).toContain("Max-Age=0");
			expect(setCookieHeader).toContain("Path=/");
		});

		test("appends deletion header to response", () => {
			const wrapper = createFami({ session: {} });
			const { context, head } = applyContext(wrapper);

			context.deleteCookie("session");

			const setCookieHeader = head.headers.get("Set-Cookie");
			expect(setCookieHeader).toStartWith("session=;");
			expect(setCookieHeader).toContain("Max-Age=0");
		});

		test("delegates to fami.delete", () => {
			const wrapper = createFami({
				session: {
					path: "/",
					domain: "example.com",
				},
			});
			const { context, head } = applyContext(wrapper);

			context.deleteCookie("session");

			const setCookieHeader = head.headers.get("Set-Cookie");
			expect(setCookieHeader).toStartWith("session=;");
			// Verify it includes default attributes from definition
			expect(setCookieHeader).toContain("Path=/");
			expect(setCookieHeader).toContain("Domain=example.com");
		});

		test("appends multiple deletion headers", () => {
			const wrapper = createFami({ session: {}, tracking: {} });
			const { context, head } = applyContext(wrapper);

			context.deleteCookie("session");
			context.deleteCookie("tracking");

			const setCookieHeaders = head.headers.getSetCookie();
			expect(setCookieHeaders).toHaveLength(2);
		});
	});

	describe("integration scenarios", () => {
		test("read cookies, set new ones, delete old ones", () => {
			const wrapper = createFami({
				session: {},
				tracking: {},
				preferences: {},
			});

			const req = mockReq("session=old_session; tracking=track_123");
			const head = mockHead();
			const context = wrapper({ timestamp: Date.now() }, {}, req, head);

			// Read existing cookies
			expect(context.cookies.session).toBe("old_session");
			expect(context.cookies.tracking).toBe("track_123");
			expect(context.cookies.preferences).toBeUndefined();

			// Perform operations
			context.setCookie("session", "new_session");
			context.setCookie("preferences", "pref_value");
			context.deleteCookie("tracking");

			// Verify headers appended
			const setCookieHeaders = head.headers.getSetCookie();
			expect(setCookieHeaders).toHaveLength(3);

			const sessionHeader = setCookieHeaders.find((header) =>
				header.startsWith("session="),
			);
			const preferencesHeader = setCookieHeaders.find((header) =>
				header.startsWith("preferences="),
			);
			const trackingHeader = setCookieHeaders.find((header) =>
				header.startsWith("tracking="),
			);

			expect(sessionHeader).toBe("session=new_session");
			expect(preferencesHeader).toBe("preferences=pref_value");
			expect(trackingHeader).toStartWith("tracking=;");
			expect(trackingHeader).toContain("Max-Age=0");
		});

		test("works with empty cookie definitions", () => {
			const wrapper = createFami({});
			const { context } = applyContext(wrapper);

			expect(context.fami).toBeDefined();
			expect(context.cookies).toEqual({});
		});

		test("ensure no overlap between user context and fami context", () => {
			const wrapper = createFami({ session: {} });

			const req = mockReq();
			const head = mockHead();

			const badContext = {
				cookies: { session: "test" },
				setCookie: null,
			};

			const context = wrapper(
				// @ts-expect-error - overlapping keys should cause type error
				badContext,
				{},
				req,
				head,
			) as unknown as ReturnType<typeof wrapper>;

			expect(context.fami).toBeDefined();
			expect(context.cookies).toEqual({ session: undefined });
			expect(context.setCookie).toBeFunction();
		});

		test("works with kaito null context and undefined context", () => {
			const wrapper = createFami({ session: {} });

			const req = mockReq();
			const head = mockHead();

			const contextWithNull = wrapper(null, {}, req, head);
			expect(contextWithNull.fami).toBeDefined();
			expect(contextWithNull.cookies).toEqual({ session: undefined });

			const contextWithUndefined = wrapper(undefined, {}, req, head);
			expect(contextWithUndefined.fami).toBeDefined();
			expect(contextWithUndefined.cookies).toEqual({ session: undefined });
		});
	});
});
