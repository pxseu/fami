import { describe, expect, test, vi } from "bun:test";
import { createFami } from "../src/kaito";

describe("kaito - createFami", () => {
	describe("context wrapper creation", () => {
		test("creates wrapper that exposes fami instance", () => {
			const wrapper = createFami(["session", "tracking"]);

			const req = { headers: new Headers() };
			const head = { headers: new Headers() };
			const getContext = () => ({ user: "test" });
			const context = wrapper(getContext)(req, head);

			if (context instanceof Promise) {
				expect.unreachable("context should not be a promise");
			}

			expect(context.fami).toBeDefined();
			expect(context.fami.getNames()).toEqual(["session", "tracking"]);
		});

		test("merges user context with fami context", () => {
			const wrapper = createFami(["session"]);

			const req = { headers: new Headers() };
			const head = { headers: new Headers() };
			const getContext = () => ({
				userId: 123,
				isAdmin: true,
			});

			const context = wrapper(getContext)(req, head);

			if (context instanceof Promise) {
				expect.unreachable("context should not be a promise");
			}

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
			const wrapper = createFami(["session"]);

			const req = { headers: new Headers() };
			const head = { headers: new Headers() };
			const getContext = () => ({});

			const context = wrapper(getContext)(req, head);

			if (context instanceof Promise) {
				expect.unreachable("context should not be a promise");
			}

			expect(context.fami).toBeDefined();
			expect(context.cookies).toBeDefined();
			expect(context.setCookie).toBeDefined();
			expect(context.deleteCookie).toBeDefined();
		});

		test("fami getter always returns same instance", () => {
			const wrapper = createFami(["session"]);

			const req = { headers: new Headers() };
			const head = { headers: new Headers() };
			const getContext = () => ({});
			const context = wrapper(getContext)(req, head);

			if (context instanceof Promise) {
				expect.unreachable("context should not be a promise");
			}

			expect(context.fami).toBe(context.fami);
		});
	});

	describe("lazy cookies getter", () => {
		test("does not parse cookies until accessed", () => {
			const wrapper = createFami(["session", "tracking"]);

			const headers = new Headers({
				Cookie: "session=abc123; tracking=xyz789",
			});

			const getSpy = vi.spyOn(headers, "get");

			const req = { headers };
			const head = { headers: new Headers() };
			const getContext = () => ({});
			const context = wrapper(getContext)(req, head);

			if (context instanceof Promise) {
				expect.unreachable("context should not be a promise");
			}

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
			const wrapper = createFami(["session"]);

			const headers = new Headers({
				Cookie: "session=abc123",
			});
			const getSpy = vi.spyOn(headers, "get");

			const req = { headers };
			const head = { headers: new Headers() };
			const getContext = () => ({});
			const context = wrapper(getContext)(req, head);

			if (context instanceof Promise) {
				expect.unreachable("context should not be a promise");
			}

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
			const wrapper = createFami(["session"]);

			const req = {
				headers: new Headers({
					Cookie: "session=abc123",
				}),
			};
			const head = { headers: new Headers() };
			const getContext = () => ({});
			const context = wrapper(getContext)(req, head);

			if (context instanceof Promise) {
				expect.unreachable("context should not be a promise");
			}

			expect(Object.isFrozen(context.cookies)).toBe(true);
		});
	});

	describe("setCookie method", () => {
		test("appends Set-Cookie header to response", () => {
			const wrapper = createFami(["session"]);

			const req = { headers: new Headers() };
			const head = { headers: new Headers() };
			const getContext = () => ({});
			const context = wrapper(getContext)(req, head);

			if (context instanceof Promise) {
				expect.unreachable("context should not be a promise");
			}

			context.setCookie("session", "new_value");

			expect(head.headers.get("Set-Cookie")).toContain("session=new_value");
		});

		test("delegates to fami.serialize with arguments", () => {
			const wrapper = createFami(["session"]);

			const req = { headers: new Headers() };
			const head = { headers: new Headers() };
			const getContext = () => ({});
			const context = wrapper(getContext)(req, head);

			if (context instanceof Promise) {
				expect.unreachable("context should not be a promise");
			}

			context.setCookie("session", "value", {
				path: "/",
				maxAge: 3600,
			});

			const setCookieHeader = head.headers.get("Set-Cookie");
			expect(setCookieHeader).toContain("session=value");
			expect(setCookieHeader).toContain("Path=/");
			expect(setCookieHeader).toContain("Max-Age=3600");
		});

		test("appends multiple Set-Cookie headers", () => {
			const wrapper = createFami(["session", "tracking"]);

			const req = { headers: new Headers() };
			const head = { headers: new Headers() };
			const getContext = () => ({});
			const context = wrapper(getContext)(req, head);

			if (context instanceof Promise) {
				expect.unreachable("context should not be a promise");
			}

			context.setCookie("session", "session_value");
			context.setCookie("tracking", "tracking_value");

			const setCookieHeaders = head.headers.getSetCookie();
			expect(setCookieHeaders).toHaveLength(2);
			expect(setCookieHeaders[0]).toContain("session=session_value");
			expect(setCookieHeaders[1]).toContain("tracking=tracking_value");
		});
	});

	describe("deleteCookie method", () => {
		test("appends deletion header to response", () => {
			const wrapper = createFami(["session"]);

			const req = { headers: new Headers() };
			const head = { headers: new Headers() };
			const getContext = () => ({});
			const context = wrapper(getContext)(req, head);

			if (context instanceof Promise) {
				expect.unreachable("context should not be a promise");
			}

			context.deleteCookie("session");

			const setCookieHeader = head.headers.get("Set-Cookie");
			expect(setCookieHeader).toContain("session=");
			expect(setCookieHeader).toContain("Max-Age=0");
		});

		test("delegates to fami.delete", () => {
			const wrapper = createFami([
				{
					name: "session",
					path: "/",
					domain: "example.com",
				},
			]);

			const req = { headers: new Headers() };
			const head = { headers: new Headers() };
			const getContext = () => ({});
			const context = wrapper(getContext)(req, head);

			if (context instanceof Promise) {
				expect.unreachable("context should not be a promise");
			}

			context.deleteCookie("session");

			const setCookieHeader = head.headers.get("Set-Cookie");
			// Verify it includes default attributes from definition
			expect(setCookieHeader).toContain("Path=/");
			expect(setCookieHeader).toContain("Domain=example.com");
		});

		test("appends multiple deletion headers", () => {
			const wrapper = createFami(["session", "tracking"]);

			const req = { headers: new Headers() };
			const head = { headers: new Headers() };
			const getContext = () => ({});
			const context = wrapper(getContext)(req, head);

			if (context instanceof Promise) {
				expect.unreachable("context should not be a promise");
			}

			context.deleteCookie("session");
			context.deleteCookie("tracking");

			const setCookieHeaders = head.headers.getSetCookie();
			expect(setCookieHeaders).toHaveLength(2);
		});
	});

	describe("async context handling", () => {
		test("awaits async user context and merges with fami context", async () => {
			const wrapper = createFami(["session"]);

			const req = {
				headers: new Headers({
					Cookie: "session=abc123",
				}),
			};
			const head = { headers: new Headers() };
			const getContext = async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				return { userId: 456 };
			};

			const contextPromise = wrapper(getContext)(req, head);

			if (!(contextPromise instanceof Promise)) {
				expect.unreachable("context should be a promise");
			}

			const context = await contextPromise;

			// User context from async function
			expect(context.userId).toBe(456);

			// Fami context
			expect(context.fami).toBeDefined();
			expect(context.cookies).toEqual({ session: "abc123" });
		});

		test("fami methods work with async context", async () => {
			const wrapper = createFami(["session"]);

			const req = { headers: new Headers() };
			const head = { headers: new Headers() };
			const getContext = async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				return { status: "authenticated" };
			};

			const contextPromise = wrapper(getContext)(req, head);

			if (!(contextPromise instanceof Promise)) {
				expect.unreachable("context should be a promise");
			}

			const context = await contextPromise;

			context.setCookie("session", "async_value");
			context.deleteCookie("session");

			const setCookieHeaders = head.headers.getSetCookie();
			expect(setCookieHeaders).toHaveLength(2);
		});
	});

	describe("integration scenarios", () => {
		test("read cookies, set new ones, delete old ones", () => {
			const wrapper = createFami(["session", "tracking", "preferences"]);

			const req = {
				headers: new Headers({
					Cookie: "session=old_session; tracking=track_123",
				}),
			};
			const head = { headers: new Headers() };
			const getContext = () => ({ timestamp: Date.now() });
			const context = wrapper(getContext)(req, head);

			if (context instanceof Promise) {
				expect.unreachable("context should not be a promise");
			}

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
		});

		test("works with empty cookie definitions", () => {
			const wrapper = createFami([]);

			const req = { headers: new Headers() };
			const head = { headers: new Headers() };
			const getContext = () => ({});
			const context = wrapper(getContext)(req, head);

			if (context instanceof Promise) {
				expect.unreachable("context should not be a promise");
			}

			expect(context.fami).toBeDefined();
			expect(context.cookies).toEqual({});
		});

		test("ensure no overlap between user context and fami context", () => {
			const wrapper = createFami(["session"]);

			const req = { headers: new Headers() };
			const head = { headers: new Headers() };
			const getContext = () => ({
				cookies: { session: "test" },
				setCookie: null,
			});

			// @ts-expect-error
			const context = wrapper(getContext)(req, head);

			if (context instanceof Promise) {
				expect.unreachable("context should not be a promise");
			}

			expect(context.fami).toBeDefined();
			// @ts-expect-error
			expect(context.cookies).toEqual({});
			expect(context.setCookie).toBeFunction();
		});
	});
});
