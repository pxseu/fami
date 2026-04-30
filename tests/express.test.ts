import { describe, expect, test, vi } from "bun:test";
import {
	fami as createFami,
	type FamiExpress,
	type FamiRequest,
	type FamiResponse,
} from "../src/express";
import { Fami, type FamiInput } from "../src/fami";

function mockReq(cookie?: string) {
	return {
		headers: { cookie } as { cookie?: string },
	};
}

function mockRes() {
	const headers: Array<{ name: string; value: string }> = [];
	let writeHeadCalled = false;
	let writeHeadArgs: unknown[] = [];

	return {
		res: {
			append(name: string, value: string) {
				headers.push({ name, value });
			},
			writeHead(...args: unknown[]) {
				writeHeadCalled = true;
				writeHeadArgs = args;
				return undefined;
			},
		},
		getAppendedHeaders(name: string) {
			return headers.filter((h) => h.name === name).map((h) => h.value);
		},
		get writeHeadCalled() {
			return writeHeadCalled;
		},
		get writeHeadArgs() {
			return writeHeadArgs;
		},
	};
}

function noop() {}

function applyMiddleware<
	CookieName extends string,
	Defs extends FamiInput<CookieName>,
>(
	fami: FamiExpress<CookieName, Defs>,
	req: ReturnType<typeof mockReq>,
	mock: ReturnType<typeof mockRes>,
	next?: (err?: unknown) => void,
) {
	fami.middleware()(req, mock.res, next ?? noop);
	return {
		req: req as ReturnType<typeof mockReq> & FamiRequest<CookieName, Defs>,
		res: mock.res as ReturnType<typeof mockRes>["res"] &
			FamiResponse<CookieName, Defs>,
	};
}

describe("express - createFami", () => {
	describe("middleware augmentation", () => {
		test("adds fami instance to req", () => {
			const fami = createFami({ session: {}, tracking: {} });
			const mock = mockRes();
			const { req } = applyMiddleware(fami, mockReq(), mock);

			expect(req.fami).toBeDefined();
			expect(req.fami.getNames()).toEqual(["session", "tracking"]);
		});

		test("adds cookies getter to req", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { req } = applyMiddleware(fami, mockReq("session=abc123"), mock);

			expect(req.cookies).toEqual({ session: "abc123" });
		});

		test("adds setCookie to res", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			expect(res.setCookie).toBeDefined();
			expect(typeof res.setCookie).toBe("function");
		});

		test("adds deleteCookie to res", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			expect(res.deleteCookie).toBeDefined();
			expect(typeof res.deleteCookie).toBe("function");
		});

		test("adds cookieJar to res", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			expect(res.cookieJar).toBeDefined();
			expect(res.cookieJar).toBeInstanceOf(Map);
			expect(res.cookieJar.size).toBe(0);
		});

		test("calls next()", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const next = vi.fn();

			applyMiddleware(fami, mockReq(), mock, next);

			expect(next).toHaveBeenCalledTimes(1);
		});

		test("works with Fami instance", () => {
			const famiInstance = new Fami({ session: {}, tracking: {} });
			const fami = createFami(famiInstance);
			const mock = mockRes();
			const { req } = applyMiddleware(fami, mockReq(), mock);

			expect(req.fami).toBe(famiInstance);
		});

		test("fami getter always returns same instance", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { req } = applyMiddleware(fami, mockReq(), mock);

			expect(req.fami).toBe(req.fami);
		});
	});

	describe("lazy cookies getter", () => {
		test("does not parse cookies until accessed", () => {
			const famiInstance = new Fami({ session: {} });
			const parseSpy = vi.spyOn(famiInstance, "parse");
			const fami = createFami(famiInstance);

			const mock = mockRes();
			const { req } = applyMiddleware(fami, mockReq("session=abc123"), mock);

			expect(parseSpy).not.toHaveBeenCalled();

			const cookies = req.cookies;

			expect(parseSpy).toHaveBeenCalledTimes(1);
			expect(cookies).toEqual({ session: "abc123" });

			parseSpy.mockRestore();
		});

		test("caches parsed cookies (returns same reference)", () => {
			const famiInstance = new Fami({ session: {} });
			const parseSpy = vi.spyOn(famiInstance, "parse");
			const fami = createFami(famiInstance);

			const mock = mockRes();
			const { req } = applyMiddleware(fami, mockReq("session=abc123"), mock);

			const cookies1 = req.cookies;
			expect(parseSpy).toHaveBeenCalledTimes(1);

			const cookies2 = req.cookies;
			expect(parseSpy).toHaveBeenCalledTimes(1);

			const cookies3 = req.cookies;
			expect(parseSpy).toHaveBeenCalledTimes(1);

			expect(cookies1).toBe(cookies2);
			expect(cookies2).toBe(cookies3);

			parseSpy.mockRestore();
		});

		test("returns frozen object", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { req } = applyMiddleware(fami, mockReq("session=abc123"), mock);

			expect(Object.isFrozen(req.cookies)).toBe(true);
		});

		test("handles undefined cookie header", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { req } = applyMiddleware(fami, mockReq(undefined), mock);

			expect(req.cookies).toEqual({ session: undefined });
		});

		test("parses multiple cookies", () => {
			const fami = createFami({ session: {}, tracking: {}, testing: {} });
			const mock = mockRes();
			const { req } = applyMiddleware(
				fami,
				mockReq("session=abc123; tracking=xyz789; testing=123"),
				mock,
			);

			expect(req.cookies).toEqual({
				session: "abc123",
				tracking: "xyz789",
				testing: "123",
			});
		});
	});

	describe("cookie jar - setCookie", () => {
		test("adds cookie to jar", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			res.setCookie("session", "new_value");

			expect(res.cookieJar.size).toBe(1);
			expect(res.cookieJar.get("session")).toBe("session=new_value");
		});

		test("serializes with attributes", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			res.setCookie("session", "value", {
				path: "/",
				maxAge: 3600,
			});

			const header = res.cookieJar.get("session");
			expect(header).toStartWith("session=value;");
			expect(header).toContain("Path=/");
			expect(header).toContain("Max-Age=3600");
		});

		test("deduplicates by cookie name (last write wins)", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			res.setCookie("session", "first");
			res.setCookie("session", "second");
			res.setCookie("session", "third");

			expect(res.cookieJar.size).toBe(1);
			expect(res.cookieJar.get("session")).toBe("session=third");
		});

		test("stores multiple different cookies", () => {
			const fami = createFami({ session: {}, tracking: {} });
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			res.setCookie("session", "session_value");
			res.setCookie("tracking", "tracking_value");

			expect(res.cookieJar.size).toBe(2);
			expect(res.cookieJar.get("session")).toBe("session=session_value");
			expect(res.cookieJar.get("tracking")).toBe("tracking=tracking_value");
		});

		test("uses default attributes from cookie definition", () => {
			const fami = createFami({
				session: {
					path: "/",
					httpOnly: true,
					secure: true,
				},
			});
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			res.setCookie("session", "value");

			const header = res.cookieJar.get("session");
			expect(header).toStartWith("session=value;");
			expect(header).toContain("Path=/");
			expect(header).toContain("HttpOnly");
			expect(header).toContain("Secure");
		});

		test("keeps latest header when earlier signed operation resolves late", async () => {
			const fami = createFami({
				session: {
					secret: "super-secret",
				},
			});
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			const pendingSigned = res.setCookie("session", "signed_value");
			const pendingDelete = res.deleteCookie("session");

			expect(pendingSigned).toBeInstanceOf(Promise);
			expect(pendingDelete).toBeInstanceOf(Promise);
			await pendingSigned;
			await pendingDelete;

			const header = res.cookieJar.get("session");
			expect(header).toStartWith("session=;");
			expect(header).toContain("Max-Age=0");
		});
	});

	describe("cookie jar - deleteCookie", () => {
		test("adds deletion to jar", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			res.deleteCookie("session");

			expect(res.cookieJar.size).toBe(1);
			const header = res.cookieJar.get("session");
			expect(header).toStartWith("session=;");
			expect(header).toContain("Max-Age=0");
		});

		test("includes default attributes from definition", () => {
			const fami = createFami({
				session: {
					path: "/",
					domain: "example.com",
				},
			});
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			res.deleteCookie("session");

			const header = res.cookieJar.get("session");
			expect(header).toStartWith("session=;");
			expect(header).toContain("Path=/");
			expect(header).toContain("Domain=example.com");
		});

		test("overwrites previous setCookie for same name", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			res.setCookie("session", "some_value");
			res.deleteCookie("session");

			expect(res.cookieJar.size).toBe(1);
			const header = res.cookieJar.get("session");
			expect(header).toStartWith("session=;");
			expect(header).toContain("Max-Age=0");
			expect(header).not.toContain("session=some_value");
		});

		test("setCookie after deleteCookie overwrites deletion", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			res.deleteCookie("session");
			res.setCookie("session", "new_value");

			expect(res.cookieJar.size).toBe(1);
			const header = res.cookieJar.get("session");
			expect(header).toBe("session=new_value");
			expect(header).not.toContain("Max-Age=0");
		});
	});

	describe("writeHead flush", () => {
		test("flushes signed cookie headers when signing is awaited", async () => {
			const fami = createFami({
				session: {
					httpOnly: true,
					secret: "super-secret",
				},
				tracking: {},
			});
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			const pendingSession = res.setCookie("session", "signed_value");
			res.setCookie("tracking", "plain_value");

			expect(pendingSession).toBeInstanceOf(Promise);
			await pendingSession;

			const writeResult = res.writeHead(201);

			expect(writeResult).toBeUndefined();

			const setCookieHeaders = mock.getAppendedHeaders("Set-Cookie");
			expect(setCookieHeaders).toHaveLength(2);
			const sessionHeader = setCookieHeaders.find((header) =>
				header.startsWith("session="),
			);
			const trackingHeader = setCookieHeaders.find((header) =>
				header.startsWith("tracking="),
			);

			expect(sessionHeader).toStartWith("session=signed_value.");
			expect(sessionHeader).toContain("; HttpOnly");
			expect(trackingHeader).toBe("tracking=plain_value");
		});

		test("throws when signed cookie is still pending", async () => {
			const fami = createFami({
				session: {
					secret: "super-secret",
				},
			});
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			const pendingSession = res.setCookie("session", "signed_value");

			expect(pendingSession).toBeInstanceOf(Promise);
			expect(() => res.writeHead(200)).toThrow("Signed cookies still pending");

			await pendingSession;
		});

		test("does not keep pending state after signed cookie rejection", async () => {
			const famiInstance = new Fami({
				session: {
					secret: "super-secret",
				},
			});
			const serializeSpy = vi
				.spyOn(famiInstance, "serialize")
				.mockReturnValue(Promise.reject(new Error("signing failed")));

			const fami = createFami(famiInstance);
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			const pendingSession = res.setCookie("session", "signed_value");
			expect(pendingSession).toBeInstanceOf(Promise);
			await expect(pendingSession).rejects.toThrow("signing failed");

			expect(() => res.writeHead(200)).not.toThrow();
			expect(mock.getAppendedHeaders("Set-Cookie")).toHaveLength(0);

			serializeSpy.mockRestore();
		});

		test("flushes jar to Set-Cookie headers on writeHead", () => {
			const fami = createFami({ session: {}, tracking: {} });
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			res.setCookie("session", "session_value");
			res.setCookie("tracking", "tracking_value");

			// Trigger writeHead
			res.writeHead(200);

			const setCookieHeaders = mock.getAppendedHeaders("Set-Cookie");
			expect(setCookieHeaders).toHaveLength(2);
			expect(setCookieHeaders[0]).toBe("session=session_value");
			expect(setCookieHeaders[1]).toBe("tracking=tracking_value");
		});

		test("does not append duplicate headers on repeated writeHead calls", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			res.setCookie("session", "value");

			res.writeHead(200);
			res.writeHead(200);

			const setCookieHeaders = mock.getAppendedHeaders("Set-Cookie");
			expect(setCookieHeaders).toHaveLength(1);
			expect(setCookieHeaders[0]).toBe("session=value");
		});

		test("does not append headers before writeHead", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			res.setCookie("session", "value");

			const setCookieHeaders = mock.getAppendedHeaders("Set-Cookie");
			expect(setCookieHeaders).toHaveLength(0);
		});

		test("flushes empty jar without error", () => {
			const fami = createFami({ session: {} });
			const req = mockReq();
			const mock = mockRes();

			fami.middleware()(req, mock.res, noop);

			// Trigger writeHead with empty jar
			mock.res.writeHead(200);

			const setCookieHeaders = mock.getAppendedHeaders("Set-Cookie");
			expect(setCookieHeaders).toHaveLength(0);
		});

		test("passes through writeHead arguments", () => {
			const fami = createFami({ session: {} });
			const req = mockReq();

			const writeHeadSpy = vi.fn();
			const res = {
				append: vi.fn(),
				writeHead: writeHeadSpy,
			};

			fami.middleware()(req, res, noop);

			res.writeHead(200, { "Content-Type": "text/html" });

			expect(writeHeadSpy).toHaveBeenCalledTimes(1);
			expect(writeHeadSpy).toHaveBeenCalledWith(200, {
				"Content-Type": "text/html",
			});
		});

		test("only flushes last value per cookie on writeHead", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			res.setCookie("session", "first");
			res.setCookie("session", "second");
			res.setCookie("session", "third");

			res.writeHead(200);

			const setCookieHeaders = mock.getAppendedHeaders("Set-Cookie");
			expect(setCookieHeaders).toHaveLength(1);
			expect(setCookieHeaders[0]).toBe("session=third");
		});
	});

	describe("handler wrapper", () => {
		test("is an identity function at runtime", () => {
			const fami = createFami({ session: {} });

			const originalHandler = () => {};
			const wrappedHandler = fami.handler(originalHandler);

			expect(wrappedHandler).toBe(originalHandler);
		});

		test("passes through to the original handler", () => {
			const fami = createFami({ session: {} });
			const handlerFn = vi.fn();
			const wrappedHandler = fami.handler(handlerFn);

			// handler is identity — calling wrapped === calling original
			expect(wrappedHandler).toBe(handlerFn);

			const req = mockReq();
			const { res } = mockRes();

			handlerFn(req, res, noop);

			expect(handlerFn).toHaveBeenCalledTimes(1);
			expect(handlerFn).toHaveBeenCalledWith(req, res, noop);
		});
	});

	describe("integration scenarios", () => {
		test("full request lifecycle: read cookies, set new, delete old, flush", () => {
			const fami = createFami({ session: {}, tracking: {}, preferences: {} });
			const mock = mockRes();
			const { req, res } = applyMiddleware(
				fami,
				mockReq("session=old_session; tracking=track_123"),
				mock,
			);

			// Read existing cookies
			expect(req.cookies.session).toBe("old_session");
			expect(req.cookies.tracking).toBe("track_123");
			expect(req.cookies.preferences).toBeUndefined();

			// Set and delete cookies
			res.setCookie("session", "new_session");
			res.setCookie("preferences", "pref_value");
			res.deleteCookie("tracking");

			// Verify jar state before flush
			expect(res.cookieJar.size).toBe(3);

			// Flush via writeHead
			res.writeHead(200);

			const setCookieHeaders = mock.getAppendedHeaders("Set-Cookie");
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
			const fami = createFami({});
			const mock = mockRes();
			const { req } = applyMiddleware(fami, mockReq(), mock);

			expect(req.fami).toBeDefined();
			expect(req.cookies).toEqual({});
		});

		test("middleware creates fresh jar per request", () => {
			const fami = createFami({ session: {} });

			// First request
			const mock1 = mockRes();
			const { res: res1 } = applyMiddleware(fami, mockReq(), mock1);
			res1.setCookie("session", "req1_value");

			// Second request
			const mock2 = mockRes();
			const { res: res2 } = applyMiddleware(fami, mockReq(), mock2);

			// Second request's jar should be empty
			expect(res2.cookieJar.size).toBe(0);

			// First request's jar should still have its cookie
			expect(res1.cookieJar.size).toBe(1);
		});

		test("middleware shares fami instance across requests", () => {
			const fami = createFami({ session: {} });

			const mock1 = mockRes();
			const { req: req1 } = applyMiddleware(fami, mockReq(), mock1);

			const mock2 = mockRes();
			const { req: req2 } = applyMiddleware(fami, mockReq(), mock2);

			expect(req1.fami).toBe(req2.fami);
		});

		test("handler + middleware work together", () => {
			const fami = createFami({ session: {} });
			const req = mockReq("session=abc123");
			const mock = mockRes();

			// Apply middleware to augment req and res
			const { res } = applyMiddleware(fami, req, mock);

			// Handler is identity at runtime
			const callback = vi.fn();
			expect(fami.handler(callback)).toBe(callback);

			// After middleware augmentation, res has setCookie
			res.setCookie("session", "updated");

			// Flush
			mock.res.writeHead(200);

			const setCookieHeaders = mock.getAppendedHeaders("Set-Cookie");
			expect(setCookieHeaders).toHaveLength(1);
			expect(setCookieHeaders[0]).toBe("session=updated");
		});
	});
});
