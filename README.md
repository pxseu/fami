# fami

> Cookies made for the modern web.

fami is a lightweight, RFC 6265bis-21 compliant cookie parsing and serialization library for HTTP servers. It's designed first and foremost to be human-friendly and easy to use. Offers similar API to the [`cookie`](https://github.com/jshttp/cookie) package.

> [!WARNING]  
> fami is still in development and all APIs are subject to change.

## Quick Start

Fami provides both a low-level API for cookie parsing and serialization, and a high-level API for type-safe cookie management. Both APIs are functionally equivalent, but the high-level API is a more convenient abstraction that provides type-safety and is recommended for most use cases.

### High-level API

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

const session = fami.serialize("session", "value");
console.log(session);
// "session=value; HttpOnly; Secure; Max-Age=3600"

const deleteSession = fami.delete("session");
console.log(deleteSession);
// "session=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
```

### Low-level API

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
// "session=value; HttpOnly; Secure; Max-Age=3600"
```

## Installation

```bash
bun add fami
# or
npm install fami
# or
yarn add fami
```

## Testing

Run the test suite:

```bash
bun test
```

The library includes comprehensive tests covering:

- Cookie header parsing (multiple cookies, quoted values, URL encoding)
- Set-Cookie serialization (all attributes)
- Edge cases and malformed cookie handling
- Special character and encoding handling

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build the package
bun run build
```

## RFC 6265bis-21 Compliance

This library implements [RFC 6265bis-21](https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-rfc6265bis-21) (December 2024), the latest revision of the HTTP State Management Mechanism specification. Key features include:

- Strict cookie name validation (HTTP tokens)
- Proper value encoding (quoted strings and URL encoding)
- Modern attributes: `SameSite`, `Partitioned`, `Priority`
- Correct date formatting per HTTP-date specification
- Graceful handling of malformed cookies
- Support for both `;` and `,` separators in Cookie headers (legacy support)

## License

MIT License, see [LICENSE](./LICENSE) for details.
