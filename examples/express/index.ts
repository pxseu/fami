import express from "express";
import { fami } from "fami/express";

const app = express();
const f = fami({ session: { maxAge: 60 * 60 } });

app.use(f.middleware());

app.get(
	"/",
	f.handler((req, res) => {
		res.json(req.cookies);
	}),
);

app.get(
	"/set-cookie",
	f.handler((_, res) => {
		res.setCookie("session", new Date().toISOString());
		res.send("Cookie set");
	}),
);

app.get(
	"/delete-cookie",
	f.handler((_, res) => {
		res.deleteCookie("session");
		res.send("Cookie deleted");
	}),
);

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
	console.log(`Listening on http://localhost:${port}`);
});
