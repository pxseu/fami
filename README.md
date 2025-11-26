# fami

> Cookies made for the modern web.

fami is a lightweight, RFC 6265bis-21 compliant cookie parsing and serialization library for HTTP servers. It's designed first and foremost to be human-friendly and easy to use. Offers a drop-in replacement for the built-in `cookie`.

> [!WARNING]  
> fami is still in development and a strict type-safe API is in the works.

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
