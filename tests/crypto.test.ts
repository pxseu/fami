import { describe, expect, test } from "bun:test";
import {
	importKey,
	signPipeline,
	signValue,
	verifyPipeline,
	verifyValue,
} from "../src/crypto";

describe("crypto", () => {
	describe("runtime support", () => {
		test("provides the Uint8Array Base64 APIs required for signed cookies", () => {
			expect(typeof Uint8Array.prototype.toBase64).toBe("function");
			expect(typeof Uint8Array.fromBase64).toBe("function");
		});
	});

	describe("importKey", () => {
		test("imports a string secret as an HMAC key", async () => {
			const key = await importKey("super-secret");

			expect(key).toBeInstanceOf(CryptoKey);
			expect(key.type).toBe("secret");
			expect(key.algorithm.name).toBe("HMAC");
			expect(key.usages).toEqual(["sign", "verify"]);
		});

		test("returns CryptoKey input as-is", async () => {
			const key = await importKey("super-secret");
			const reused = await importKey(key);

			expect(reused).toBe(key);
		});
	});

	describe("signValue and verifyValue", () => {
		test("round-trips a signed value", async () => {
			const key = await importKey("super-secret");
			const signed = await signValue(key, "hello-world");

			expect(signed.startsWith("hello-world.")).toBe(true);

			const signature = signed.slice("hello-world.".length);
			expect(signature).toMatch(/^[A-Za-z0-9_-]+=*$/);

			expect(await verifyValue(key, signed)).toBe("hello-world");
		});

		test("returns undefined when signature or value is tampered", async () => {
			const key = await importKey("super-secret");
			const signed = await signValue(key, "hello-world");

			const tamperedValue = signed.replace("hello-world", "hello-world!");
			expect(await verifyValue(key, tamperedValue)).toBeUndefined();

			const last = signed.at(-1);
			const replacement = last === "A" ? "B" : "A";
			const tamperedSig = `${signed.slice(0, -1)}${replacement}`;
			expect(await verifyValue(key, tamperedSig)).toBeUndefined();
		});

		test("returns undefined for values without a separator", async () => {
			const key = await importKey("super-secret");

			expect(await verifyValue(key, "unsigned-value")).toBeUndefined();
		});
	});

	describe("signPipeline and verifyPipeline", () => {
		test("returns undefined for empty signed values", async () => {
			expect(await verifyPipeline("pipeline-secret", "")).toBeUndefined();
		});

		test("supports string, CryptoKey, and Promise<CryptoKey> inputs", async () => {
			const value = "pipeline-value";
			const cryptoKey = await importKey("pipeline-secret");

			const fromString = await signPipeline("pipeline-secret", value);
			const fromCryptoKey = await signPipeline(cryptoKey, value);
			const fromPromise = await signPipeline(Promise.resolve(cryptoKey), value);

			expect(fromString).toBe(fromCryptoKey);
			expect(fromPromise).toBe(fromCryptoKey);

			expect(await verifyPipeline("pipeline-secret", fromString)).toBe(value);
			expect(await verifyPipeline(cryptoKey, fromCryptoKey)).toBe(value);
			expect(
				await verifyPipeline(Promise.resolve(cryptoKey), fromPromise),
			).toBe(value);
		});

		test("returns undefined when verified with a different secret", async () => {
			const signed = await signPipeline("secret-a", "payload");

			expect(await verifyPipeline("secret-b", signed)).toBeUndefined();
		});

		test("doesnt throw on invalid b64 segments", async () => {
			const verified = await verifyPipeline("test-secret", "invalid.XDDDDDD");

			expect(verified).toBeUndefined();
		});

		test("works with signature being padded base64url", async () => {
			const paddedSigned =
				"hello-world.LWzce8F2WlVrCK7pObyK9S3WFXnTFdflha6H1S1KAHA=";

			expect(await verifyPipeline("super-secret", paddedSigned)).toBe(
				"hello-world",
			);
		});

		test("handles discord-like token payloads with multiple base64url segments", async () => {
			const discordLikeToken = "MTc1OTI4ODQ3Mjk5MTE3MDYz.Dc9r_A";

			const signed = await signPipeline("discord-secret", discordLikeToken);

			expect(signed.split(".")).toHaveLength(3);
			expect(await verifyPipeline("discord-secret", signed)).toBe(
				discordLikeToken,
			);

			const parts = signed.split(".");
			parts[1] = "dGFtcGVyZWQ";
			const tampered = parts.join(".");

			expect(await verifyPipeline("discord-secret", tampered)).toBeUndefined();
		});
	});
});
