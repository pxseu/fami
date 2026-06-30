import { create } from "@kaito-http/core";
import { fami } from "fami/kaito";

const kaito = create({
	getContext: () => ({ test: 1 }),
}).pipe(
	fami({
		session: { maxAge: 60 * 60, prefix: "secure" },
	}),
);

const app = kaito
	.get("/", ({ ctx }) => ctx.cookies)
	.get("/set-cookie", ({ ctx }) => {
		ctx.setCookie("session", new Date().toISOString());
		const _: number = ctx.test;
		return "Cookie set";
	})
	.get("/delete-cookie", ({ ctx }) => {
		ctx.deleteCookie("session");

		return "Cookie deleted";
	});

const server = Bun.serve({
	fetch: app.serve(),
});

console.log(`Listening on ${server.url}`);
