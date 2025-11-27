import { create } from "@kaito-http/core";
import { createFami } from "fami/kaito";

const context = createFami(["session"]);

const kaito = create({
	getContext: context(async (req, head) => ({
		req,
		head,
	})),
});

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
