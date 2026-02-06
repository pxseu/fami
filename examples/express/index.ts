import express from "express";
import { createFami } from "fami/express";

const app = express();
const fami = createFami(["session"]);

app.use(fami.middleware());

app.get(
	"/",
	fami.handler((req, res) => {
		res.json(req.cookies);
	}),
);

app.get(
	"/set-cookie",
	fami.handler((_, res) => {
		res.setCookie("session", new Date().toISOString());
		res.send("Cookie set");
	}),
);

app.get(
	"/delete-cookie",
	fami.handler((_, res) => {
		res.deleteCookie("session");
		res.send("Cookie deleted");
	}),
);

app.listen(3000, () => {
	console.log("Listening on http://localhost:3000");
});
