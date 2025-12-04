import { Fami } from "fami";

const fami = new Fami(["session"]);

export default {
	async fetch(req): Promise<Response> {
		const url = new URL(req.url);

		const headers = new Headers();
		headers.set("Content-Type", "application/json");

		switch (url.pathname) {
			case "/": {
				const cookies = fami.parse(req.headers.get("Cookie"));
				return new Response(JSON.stringify(cookies), {
					headers,
				});
			}

			case "/set-cookie": {
				headers.append(
					"Set-Cookie",
					fami.serialize("session", new Date().toISOString()),
				);
				return new Response(JSON.stringify("Cookie set"), { headers });
			}

			case "/delete-cookie": {
				headers.append("Set-Cookie", fami.delete("session"));
				return new Response(JSON.stringify("Cookie deleted"), { headers });
			}

			default:
				return new Response("Not found", { status: 404 });
		}
	},
} satisfies ExportedHandler<Env>;
