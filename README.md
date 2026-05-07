# fami

![NPM Version](https://img.shields.io/npm/v/fami) ![License](https://img.shields.io/npm/l/fami) ![npm package minimized gzipped size](https://img.shields.io/bundlejs/size/fami) [![Publishing](https://github.com/pxseu/fami/actions/workflows/publish.yml/badge.svg)](https://github.com/pxseu/fami/actions/workflows/publish.yml) [![Tests](https://github.com/pxseu/fami/actions/workflows/test.yml/badge.svg)](https://github.com/pxseu/fami/actions/workflows/test.yml)

Working with cookies shouldn't be complicated or scary. **fami** makes HTTP cookie management simple, safe, and type-safe.

**fami** is a lightweight library focused on correctness and developer experience, following the modern RFC 6265bis draft with an intuitive API designed for today's web.

## Table of Contents

- [Features](#features)
- [Why fami?](#why-fami)
- [Compatibility](#compatibility)
- [Installation](#installation)
- [Quick Start](#quick-start)
  - [High-level API (recommended)](#high-level-api-recommended)
  - [Signed cookies (async behavior)](#signed-cookies-async-behavior)
  - [Low-level API](#low-level-api)
- [Framework Integration](#framework-integration)
  - [Kaito](#kaito)
  - [Express](#express)
- [RFC Compliance](#rfc-compliance)
- [Inspirations](#inspirations)
- [Development](#development)
- [License](#license)

## Features

- Schema-based cookie definitions with type-safe parsing and serialization
- Flexible cookie parsing/serialization
- First-class integration with [**Express**](https://expressjs.com/) and [**Kaito**](https://github.com/kaito-http/kaito)
- Safe, predictable behavior following the latest HTTP State Management draft ([RFC 6265bis](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-21))
- Strong TypeScript support with extensive JSDoc
- Zero dependencies, tiny footprint
- Signed cookie support with secure defaults and modern algorithms (HMAC-SHA256)

## Why fami?

If you're already using a cookie library, you might wonder why you should switch. Here's what sets **fami** apart:

**vs. [`cookie`](https://github.com/jshttp/cookie)** (the most popular choice)

> **Note:** `cookie` is a perfectly valid choice and is very well maintained. It has been around for a long time and is a well-established library with battle-tested code and a large community.

- fami provides a high-level schema-based API that prevents cookie configuration drift across your codebase
- Strong RFC 6265bis alignment with modern parsing rules
- Better TypeScript support with extensive JSDoc comments

**vs. rolling your own**

- Cookie parsing/serialization has many edge cases (whitespace, special characters, encoding, attribute ordering)
- RFC 6265bis compliance requires careful handling of modern attributes
- Manual cookie handling is error-prone (typos, missing attributes, type mismatches) and hard to maintain across a codebase

**Perfect for:**

- New projects that want modern cookie handling out of the box
- Teams migrating to edge runtimes or modern frameworks
- Developers who want type-safe cookie management with minimal boilerplate

## Compatibility

**fami** is runtime-agnostic and works across modern JavaScript runtimes that implement the Web APIs listed below.

It does, however, require the following modern APIs:

- [`SubtleCrypto`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) for secure signing of cookies (if using signed cookies)
- [`TextEncoder`](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder) for encoding/decoding cookie binary values
- [`Uint8Array` Base64 APIs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/toBase64) (`Uint8Array.prototype.toBase64` and `Uint8Array.fromBase64`) for signed cookie base64url encoding/decoding

This being exactly one of the following:

- Node.js 25+
- Bun 1.1.22+
- Deno 2.5.0+

Vercel Edge Functions, Cloudflare Workers, and other modern edge runtimes should also be compatible but have not been extensively tested.

## Installation

```bash
bun add fami
# or
npm install fami
# or
yarn add fami
# or
pnpm add fami
```

## Quick Start

### High-level API (recommended)

The high-level API provides a simple abstraction for managing cookie names and attributes. Define your cookie names once and use them throughout your application with full type safety. Set sane defaults for your cookies and serialize or parse them without worrying about edge cases.

```ts
import { Fami } from "fami";

const fami = new Fami({
	theme: {},
	session: {
		httpOnly: true,
		secure: true,
		maxAge: 3600,
	},
});

const cookies = fami.parse("theme=light; session=value");

console.log(cookies);
// { theme: "light", session: "value" }

const theme = fami.serialize("theme", "light");
console.log(theme);
// "theme=light"

// You can also override the default attributes with your own
const session = fami.serialize("session", "value", {
	maxAge: 7200,
});
console.log(session);
// "session=value; Max-Age=7200; Secure; HttpOnly"

const deleteSession = fami.delete("session");
console.log(deleteSession);
// "session=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
```

### Signed cookies (async behavior)

If a cookie definition includes `secret`, related operations become asynchronous across fami and all adapters.

For secret cookies:

- `fami.serialize(...)` and `fami.delete(...)` return `Promise<string>`
- `fami.parse(...).cookieName` returns `Promise<string | undefined>`
- adapter helpers like `ctx.setCookie(...)`, `ctx.deleteCookie(...)`, `res.setCookie(...)`, and `res.deleteCookie(...)` should be awaited before response is sent

```ts
import { Fami } from "fami";

const fami = new Fami({
	session: {
		httpOnly: true,
		secure: true,
		secret: "super-secret",
	},
});

const header = await fami.serialize("session", "abc123");
console.log(header);
// "session=abc123.<signature>; Secure; HttpOnly"

const cookieHeader = header.split(";")[0];
const cookies = fami.parse(cookieHeader);
const session = await cookies.session;

console.log(session);
// "abc123"
```

### Low-level API

Useful when you want more control or are moving away from other libraries. You can quickly check whether fami is compatible with your existing code. If it is, you should usually migrate to the high-level API.

```ts
import { parse } from "fami";

const cookies = parse("foo=bar; baz=qux");

console.log(cookies);
// { foo: "bar", baz: "qux" }
```

```ts
import { serialize } from "fami";

const cookie = serialize("session", "value", {
	httpOnly: true,
	secure: true,
	maxAge: 3600,
});

console.log(cookie);
// "session=value; Max-Age=3600; Secure; HttpOnly"
```

## Framework Integration

### Kaito

**[Kaito](https://github.com/kaito-http/kaito)** is a modern, type-safe functional HTTP framework.

**fami** provides first-class Kaito support through a small utility that extends the Kaito context with fami's methods. It adds helpers like `ctx.setCookie("session", "value")` and `ctx.deleteCookie("session")` directly to the Kaito context.

```ts
import { create } from "@kaito-http/core";
import { fami } from "fami/kaito";

const kaito = create().pipe(
	fami({
		session: { maxAge: 60 * 60 },
	}),
);

const app = kaito
	.get("/", ({ ctx }) => {
		return ctx.cookies;
	})
	.get("/set-cookie", ({ ctx }) => {
		ctx.setCookie("session", new Date().toISOString());
		return "Cookie set";
	});

Bun.serve({
	fetch: app.serve(),
});
```

For more details, you can take a look at the [examples](./examples/kaito/index.ts).

### Express

**[Express](https://expressjs.com/)** is the most popular web framework for Node.js.

fami provides a dedicated Express adapter through `fami/express` that gives you type-safe cookie management with full Express autocomplete. The adapter provides a middleware that augments `req` and `res` with fami's methods, and a `handler()` wrapper that narrows the types so `req.cookies`, `res.setCookie()`, `res.deleteCookie()` and `res.json()` all have full autocomplete and type safety.

> [!IMPORTANT]
> You MUST install the `@types/express` package manually for the best experience.

```ts
import express from "express";
import { fami } from "fami/express";

const app = express();
const f = fami({ session: {} });

app.use(f.middleware());

app.get(
	"/",
	f.handler((req, res) => {
		const session = req.cookies.session; // typed as string | undefined

		res.setCookie("session", "value"); // autocomplete for cookie names
		res.json({ session }); // full Express autocomplete
	}),
);

app.listen(3000);
```

For more details, you can take a look at the [examples](./examples/express/index.ts).

## RFC Compliance

**fami** targets the latest HTTP State Management draft (**RFC 6265bis**, draft-22 as of December 2025) and will track newer drafts as the spec evolves.

Highlights:

- **Standard attributes:** Full support for RFC 6265bis attributes including `Expires`, `Max-Age`, `Domain`, `Path`, `Secure`, `HttpOnly`, and `SameSite`.
- **Extension attributes:** Support for [`Partitioned` (CHIPS)](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Privacy_sandbox/Partitioned_cookies) and `Priority`.
- Follows modern parsing rules
- Is backwards compatible with the legacy RFC 6265 syntax
- Strict attribute validation and draft-safe value serialization
- Serialization consistent with draft syntax expectations

## Inspirations

fami was inspired by the following libraries:

- [cookie](https://github.com/jshttp/cookie) - The most popular cookie library, it is a well-established library with battle-tested code and a large community.
- [pika](https://github.com/Phineas/pika/tree/main/impl/js) - Fully typed, 0 dependencies JS implementation of the full Pika specification.

## Development

### Prerequisites

Although **fami** is runtime-agnostic, it is developed and tested with Bun. Using Bun for local development is recommended.

```bash
# install deps
bun install

# dry-run the publish flow to see what would be published
# this also builds the package and runs the test suite
NPM_CONFIG_TOKEN=stub bun publish --dry-run
```

### Testing

```bash
bun t
```

The above command is a shortcut for `bun run test` that executes the test suite and generates a coverage report via Bun's built-in coverage tool.

The test suite covers:

- Attribute correctness
- Legacy separators
- Serialization stability
- Path/domain/expiration handling
- Edge cases around whitespace, casing, and malformed input

### Publishing

Releases are published automatically via GitHub Actions. Existing npm versions are never overwritten, each release is immutable, and every publish uses a new semver tag.

You can inspect the publish workflow in [publish.yml](./.github/workflows/publish.yml).

## License

MIT License, see [LICENSE](./LICENSE) for details.
