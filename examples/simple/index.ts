import { parse, serialize } from "fami";

const server = Bun.serve({
	port: 3000,
	fetch(req) {
		const url = new URL(req.url);

		const headers = new Headers();
		headers.set("Content-Type", "text/plain");
		headers.append(
			"Set-Cookie",
			serialize("last_visited", url.pathname, {
				expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
			}),
		);

		switch (url.pathname) {
			case "/": {
				return new Response("Hello from Bun!", {
					headers,
				});
			}

			case "/cookies": {
				const cookies = parse(req.headers.get("Cookie"));
				headers.set("Content-Type", "application/json");
				return new Response(JSON.stringify({ cookies }), { headers });
			}

			default:
				return new Response("Not found", { status: 404 });
		}
	},
});

console.log(`Listening on http://localhost:${server.port}`);
