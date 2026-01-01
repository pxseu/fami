# fami

![NPM Version](https://img.shields.io/npm/v/fami) ![License](https://img.shields.io/npm/l/fami) ![npm package minimized gzipped size](https://img.shields.io/bundlejs/size/fami) [![Publishing](https://github.com/pxseu/fami/actions/workflows/publish.yml/badge.svg)](https://github.com/pxseu/fami/actions/workflows/publish.yml) [![Tests](https://github.com/pxseu/fami/actions/workflows/test.yml/badge.svg)](https://github.com/pxseu/fami/actions/workflows/test.yml)

Working with cookies shouldn't be complicated or scary. **fami** makes HTTP cookie management simple, safe, and of course type-safe.

**fami** is a lightweight library focused on correctness and developer experience, following modern RFC 6265bis standards with an intuitive API designed for today's web.

## Table of Contents

- [Features](#features)
- [Why fami?](#why-fami)
- [Compatibility](#compatibility)
- [Installation](#installation)
- [Quick Start](#quick-start)
  - [High-level API (recommended)](#highlevel-api-recommended)
  - [Low-level API](#lowlevel-api)
- [Framework Integration](#framework-integration)
  - [Kaito](#kaito)
- [RFC Compliance](#rfc-compliance)
- [Inspirations](#inspirations)
- [Development](#development)
- [License](#license)

## Features

- Schema-based abstraction for cookie definitions and serializing/parsing cookies with type safety
- Flexible cookie parsing/serialization
- First‑class integration with [**Kaito**](https://github.com/kaito-http/kaito)
- Safe, predictable behavior following the latest HTTP State Management draft ([RFC 6265bis](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-21))
- Strong TypeScript support with extensive JSDoc
- Zero dependencies, tiny footprint

## Why fami?

If you're already using a cookie library, you might wonder why you should switch. Here's what sets **fami** apart:

**vs. [`cookie`](https://github.com/jshttp/cookie)** (the most popular choice)

> **Note:** `cookie` is a perfectly valid choice and is very well maintained. It has been around for a long time and is a well-established library with battle-tested code and a large community.

- fami provides a high-level schema-based API that prevents cookie configuration drift across your codebase
- Full RFC 6265bis compliance with modern parsing rules
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

**fami** is runtime-agnostic and works in all of your favorite runtimes. Such as but not limited to: Bun, Node.js, Deno, Cloudflare Workers, Vercel, Netlify, and more.

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

### High‑level API (recommended)

The High-level API provides a simple and intuitive abstraction for managing your cookie attributes and names. Define your cookie names once and use them throughout your application with full type safety. Set sane defaults for your cookies and serialize/parse them worry free of edge cases.

```ts
import { Fami } from "fami";

const fami = new Fami([
  "theme",
  {
    name: "session",
    httpOnly: true,
    secure: true,
    maxAge: 3600,
  },
]);

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

### Low‑level API

Useful when you want more control or are moving away from other libraries. You can easily check if Fami is compatible with your existing code. If it is, you _should_ migrate over to the High-level API.

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

fami provides first‑class [**Kaito**](https://github.com/kaito-http/kaito) support through a tiny utility that extends the Kaito context with fami's methods. The utility adds functions like `ctx.setCookie("session", "value")` and `ctx.deleteCookie("session")` to the Kaito context which make it a great experience to work with.

```ts
import { create } from "@kaito-http/core";
import { createFami } from "fami/kaito";

const context = createFami(["session"]);

const kaito = create({
  getContext: context((req, head) => ({ req, head })),
});

const app = kaito.get("/", ({ ctx }) => {
  const session = ctx.cookies.session;

  if (session) {
    return {
      message: "You are logged in!",
    };
  }

  throw new KaitoError(401, "Unauthorized");
});

Bun.serve({
  fetch: app.serve(),
});
```

For more details, you can take a look at the [examples](./examples/kaito/index.ts).

## RFC Compliance

fami targets the latest HTTP State Management draft (**RFC 6265bis**, draft‑21 as of 2025), and future drafts onwards.

Highlights:

- **Modern Attributes:** Full support for [`Partitioned` (CHIPS)](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Privacy_sandbox/Partitioned_cookies), `Priority`, and `SameSite` configuration.
- Follows modern parsing rules
- Is backwards compatible with the legacy RFC 6265 syntax
- Strict attribute handling
- Serialization consistent with draft syntax expectations

## Inspirations

fami was inspired by the following libraries:

- [cookie](https://github.com/jshttp/cookie) - The most popular cookie library, it is a well-established library with battle-tested code and a large community.
- [pika](https://github.com/Phineas/pika/tree/main/impl/js) - Fully typed, 0 dependencies JS implementation of the full Pika specification.

## Development

### Prerequisites

Although **fami** is runtime-agnostic, it is developed and tested using Bun. It is advised to use Bun when developing.

```bash
# install deps
bun install

# dry run the publish command to see what would be published,
# this also runs the test suite and builds the package
bun run publish --dry-run
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

Releases are published automatically via GitHub Actions. Existing versions on npm are never overwritten and each release is immutable, and new versions are always published with a new semver tag.

## License

MIT License, see [LICENSE](./LICENSE) for details.
