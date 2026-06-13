const SEPARATOR = ".";
const ENCODING = "base64url";

const ALGORITHM = { name: "HMAC", hash: "SHA-256" } as const;
const USAGES = ["sign", "verify"] as const satisfies KeyUsage[];

const encoder = new TextEncoder();

function pad64(str: string): string {
	const mod = str.length % 4;

	if (!mod) {
		return str;
	}

	return str.padEnd(str.length + 4 - mod, "=");
}

function to64Url(bytes: ArrayBuffer): string {
	return new Uint8Array(bytes).toBase64({
		alphabet: ENCODING,
		// not a fan of it
		omitPadding: true,
	});
}

function from64Url(str: string): Uint8Array<ArrayBuffer> | false {
	try {
		return Uint8Array.fromBase64(pad64(str), {
			alphabet: ENCODING,
			lastChunkHandling: "strict",
		});
	} catch {
		return false;
	}
}

export function importKey(
	key: string | CryptoKey | Promise<CryptoKey>,
): Promise<CryptoKey> {
	if (key instanceof Promise) {
		return key;
	}

	if (key instanceof CryptoKey) {
		return Promise.resolve(key);
	}

	return crypto.subtle.importKey(
		"raw",
		encoder.encode(key),
		ALGORITHM,
		false,
		USAGES,
	);
}

export async function signValue(
	key: CryptoKey,
	value: string,
): Promise<string> {
	const digest = await crypto.subtle.sign(
		ALGORITHM,
		key,
		encoder.encode(value),
	);

	return `${value}${SEPARATOR}${to64Url(digest)}`;
}

export async function signPipeline(
	key: string | CryptoKey | Promise<CryptoKey>,
	value: string,
) {
	if (!value) return value;

	const cryptoKey = await importKey(key);

	return signValue(cryptoKey, value);
}

export async function verifyValue(
	key: CryptoKey,
	signedValue: string,
): Promise<string | undefined> {
	const lastDotIndex = signedValue.lastIndexOf(SEPARATOR);
	if (lastDotIndex === -1) {
		return undefined;
	}

	const value = signedValue.slice(0, lastDotIndex);
	const sig = signedValue.slice(lastDotIndex + 1);

	const bytes = from64Url(sig);

	if (!bytes) {
		return undefined;
	}

	const valid = await crypto.subtle.verify(
		ALGORITHM,
		key,
		bytes,
		encoder.encode(value),
	);

	return valid ? value : undefined;
}

export async function verifyPipeline(
	key: string | CryptoKey | Promise<CryptoKey>,
	signedValue: string,
): Promise<string | undefined> {
	const cryptoKey = await importKey(key);

	return verifyValue(cryptoKey, signedValue);
}
