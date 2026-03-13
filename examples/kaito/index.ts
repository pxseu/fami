import { create } from "@kaito-http/core";
import { fami } from "fami/kaito";

const kaito = create().pipe(
	fami({
		session: { maxAge: 60 * 60 },
	}),
);

const app = kaito
	.get("/", ({ ctx }) => ctx.cookies)
	.get("/set-cookie", ({ ctx }) => {
		ctx.setCookie("session", new Date().toISOString());

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
