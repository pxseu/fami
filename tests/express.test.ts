import { describe, expect, test, vi } from "bun:test";
import {
	fami as createFami,
	type FamiExpress,
	type FamiRequest,
	type FamiResponse,
} from "../src/express";
import { Fami, type FamiInput } from "../src/fami";

function mockReq(cookie?: string | string[]) {
	return {
		headers: { cookie } as { cookie?: string | string[] },
	};
}

function mockRes() {
	const headers: Array<{ name: string; value: string }> = [];

	return {
		res: {
			append(name: string, value: string) {
				headers.push({ name, value });
			},
		},
		getAppendedHeaders(name: string) {
			return headers.filter((h) => h.name === name).map((h) => h.value);
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

			expect(req.fami.getNames()).toEqual(["session", "tracking"]);
		});

		test("adds setCookie and deleteCookie to res", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			expect(typeof res.setCookie).toBe("function");
			expect(typeof res.deleteCookie).toBe("function");
		});

		test("calls next()", () => {
			const fami = createFami({ session: {} });
			const next = vi.fn();

			applyMiddleware(fami, mockReq(), mockRes(), next);

			expect(next).toHaveBeenCalledTimes(1);
		});

		test("accepts a pre-built Fami instance", () => {
			const famiInstance = new Fami({ session: {}, tracking: {} });
			const fami = createFami(famiInstance);
			const { req } = applyMiddleware(fami, mockReq(), mockRes());

			expect(req.fami).toBe(famiInstance);
		});

		test("shares the fami instance across requests", () => {
			const fami = createFami({ session: {} });

			const { req: req1 } = applyMiddleware(fami, mockReq(), mockRes());
			const { req: req2 } = applyMiddleware(fami, mockReq(), mockRes());

			expect(req1.fami).toBe(req2.fami);
		});

		test("throws when applied twice to the same req/res", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { req } = applyMiddleware(fami, mockReq("session=abc123"), mock);

			expect(() => fami.middleware()(req, mock.res, noop)).toThrow(
				"cannot install fami",
			);
		});

		test("throws when a different adapter is applied to the same req/res", () => {
			const publicCookies = createFami({ public: {} });
			const sessionCookies = createFami({
				session: { httpOnly: true, secure: true },
			});
			const req = mockReq("session=attacker; public=seen");
			const mock = mockRes();

			applyMiddleware(publicCookies, req, mock);

			expect(() => sessionCookies.middleware()(req, mock.res, noop)).toThrow(
				"cannot install fami",
			);
		});

		test("throws before overwriting existing cookie helpers", () => {
			const fami = createFami({ session: {} });
			const req = Object.assign(mockReq("session=abc123"), {
				cookies: { session: "from-cookie-parser" },
			});
			const mock = mockRes();

			expect(() => fami.middleware()(req, mock.res, noop)).toThrow(
				"cannot install cookies",
			);
		});
	});

	describe("lazy cookies getter", () => {
		test("does not parse until first access, then caches", () => {
			const famiInstance = new Fami({ session: {} });
			const parseSpy = vi.spyOn(famiInstance, "parse");
			const fami = createFami(famiInstance);

			const { req } = applyMiddleware(
				fami,
				mockReq("session=abc123"),
				mockRes(),
			);

			expect(parseSpy).not.toHaveBeenCalled();

			const cookies1 = req.cookies;
			const cookies2 = req.cookies;
			const cookies3 = req.cookies;

			expect(parseSpy).toHaveBeenCalledTimes(1);
			expect(cookies1).toBe(cookies2);
			expect(cookies2).toBe(cookies3);
			expect(cookies1).toEqual({ session: "abc123" });

			parseSpy.mockRestore();
		});

		test("returns frozen object", () => {
			const fami = createFami({ session: {} });
			const { req } = applyMiddleware(
				fami,
				mockReq("session=abc123"),
				mockRes(),
			);

			expect(Object.isFrozen(req.cookies)).toBe(true);
		});

		test("handles undefined cookie header", () => {
			const fami = createFami({ session: {} });
			const { req } = applyMiddleware(fami, mockReq(undefined), mockRes());

			expect(req.cookies).toEqual({ session: undefined });
		});

		test("parses repeated Cookie header fields", () => {
			const fami = createFami({ session: {}, tracking: {}, testing: {} });
			const { req } = applyMiddleware(
				fami,
				mockReq(["session=abc123; tracking=xyz789", "testing=123"]),
				mockRes(),
			);

			expect(req.cookies).toEqual({
				session: "abc123",
				tracking: "xyz789",
				testing: "123",
			});
		});
	});

	describe("setCookie", () => {
		test("appends a Set-Cookie header immediately", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			res.setCookie("session", "new_value");

			expect(mock.getAppendedHeaders("Set-Cookie")).toEqual([
				"session=new_value",
			]);
		});

		test("applies definition defaults and call-site attributes", () => {
			const fami = createFami({
				session: { path: "/", httpOnly: true, secure: true },
			});
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			res.setCookie("session", "value", { maxAge: 3600 });

			const [header] = mock.getAppendedHeaders("Set-Cookie");
			expect(header).toStartWith("session=value;");
			expect(header).toContain("Path=/");
			expect(header).toContain("HttpOnly");
			expect(header).toContain("Secure");
			expect(header).toContain("Max-Age=3600");
		});

		test("each call appends an independent Set-Cookie header", () => {
			const fami = createFami({ session: {}, tracking: {} });
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			res.setCookie("session", "session_value");
			res.setCookie("tracking", "tracking_value");

			expect(mock.getAppendedHeaders("Set-Cookie")).toEqual([
				"session=session_value",
				"tracking=tracking_value",
			]);
		});

		test("returns a Promise for signed cookies", async () => {
			const fami = createFami({ session: { secret: "super-secret" } });
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			const pending = res.setCookie("session", "signed_value");
			expect(pending).toBeInstanceOf(Promise);

			expect(mock.getAppendedHeaders("Set-Cookie")).toHaveLength(0);

			await pending;

			const [header] = mock.getAppendedHeaders("Set-Cookie");
			expect(header).toStartWith("session=signed_value.");
		});
	});

	describe("deleteCookie", () => {
		test("appends a deletion header", () => {
			const fami = createFami({ session: {} });
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			res.deleteCookie("session");

			const [header] = mock.getAppendedHeaders("Set-Cookie");
			expect(header).toStartWith("session=;");
			expect(header).toContain("Max-Age=0");
		});

		test("includes default attributes from definition", () => {
			const fami = createFami({
				session: { path: "/", domain: "example.com" },
			});
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			res.deleteCookie("session");

			const [header] = mock.getAppendedHeaders("Set-Cookie");
			expect(header).toContain("Path=/");
			expect(header).toContain("Domain=example.com");
		});

		test("returns a Promise for signed cookies", async () => {
			const fami = createFami({
				session: { path: "/", secret: "super-secret" },
			});
			const mock = mockRes();
			const { res } = applyMiddleware(fami, mockReq(), mock);

			const pending = res.deleteCookie("session");
			expect(pending).toBeInstanceOf(Promise);

			await pending;

			const [header] = mock.getAppendedHeaders("Set-Cookie");
			expect(header).toStartWith("session=;");
			expect(header).toContain("Max-Age=0");
		});
	});

	describe("handler wrapper", () => {
		test("is an identity function at runtime", () => {
			const fami = createFami({ session: {} });
			const original = () => {};

			expect(fami.handler(original)).toBe(original);
		});
	});

	describe("integration scenarios", () => {
		test("full request lifecycle: read cookies, set new, delete old", () => {
			const fami = createFami({
				session: {},
				tracking: {},
				preferences: {},
			});
			const mock = mockRes();
			const { req, res } = applyMiddleware(
				fami,
				mockReq("session=old_session; tracking=track_123"),
				mock,
			);

			expect(req.cookies.session).toBe("old_session");
			expect(req.cookies.tracking).toBe("track_123");
			expect(req.cookies.preferences).toBeUndefined();

			res.setCookie("session", "new_session");
			res.setCookie("preferences", "pref_value");
			res.deleteCookie("tracking");

			const headers = mock.getAppendedHeaders("Set-Cookie");
			expect(headers).toHaveLength(3);
			expect(headers[0]).toBe("session=new_session");
			expect(headers[1]).toBe("preferences=pref_value");
			expect(headers[2]).toStartWith("tracking=;");
			expect(headers[2]).toContain("Max-Age=0");
		});

		test("works with empty cookie definitions", () => {
			const fami = createFami({});
			const { req } = applyMiddleware(fami, mockReq(), mockRes());

			expect(req.fami).toBeDefined();
			expect(req.cookies).toEqual({});
		});
	});
});
