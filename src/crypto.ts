const SEPARATOR = ".";
const ENCODING = "base64url";
const ALGORITHM = { name: "HMAC", hash: "SHA-256" } as const;

function pad64(str: string): string {
	if (str.length % 4 === 0) {
		return str;
	}

	return `${str}${"=".repeat(4 - (str.length % 4))}`;
}

function to64Url(bytes: ArrayBuffer): string {
	return new Uint8Array(bytes).toBase64({
		alphabet: ENCODING,
		// not a fan of it
		omitPadding: true,
	});
}

function from64url(str: string): Uint8Array<ArrayBuffer> | false {
	try {
		return Uint8Array.fromBase64(pad64(str), {
			alphabet: ENCODING,
			lastChunkHandling: "strict",
		});
	} catch (_) {
		return false;
	}
}

export function importKey(key: string | CryptoKey): Promise<CryptoKey> {
	if (key instanceof CryptoKey) {
		return Promise.resolve(key);
	}

	return crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(key),
		ALGORITHM,
		false,
		["sign", "verify"],
	);
}

export async function signValue(
	key: CryptoKey,
	value: string,
): Promise<string> {
	const digest = await crypto.subtle.sign(
		ALGORITHM,
		key,
		new TextEncoder().encode(value),
	);

	return `${value}${SEPARATOR}${to64Url(digest)}`;
}

export async function signPipeline(
	key: string | CryptoKey | Promise<CryptoKey>,
	value: string,
) {
	let crypto_key: CryptoKey;

	if (key instanceof Promise) {
		crypto_key = await key;
	} else if (key instanceof CryptoKey) {
		crypto_key = key;
	} else {
		crypto_key = await importKey(key);
	}

	return await signValue(crypto_key, value);
}

export async function verifyValue(
	key: CryptoKey,
	signedValue: string,
): Promise<string | false> {
	const lastDotIndex = signedValue.lastIndexOf(SEPARATOR);
	if (lastDotIndex === -1) {
		return false;
	}

	const value = signedValue.slice(0, lastDotIndex);
	const sig = signedValue.slice(lastDotIndex + 1);

	const bytes = from64url(sig);

	if (!bytes) {
		return false;
	}

	const valid = await crypto.subtle.verify(
		ALGORITHM,
		key,
		bytes,
		new TextEncoder().encode(value),
	);

	return valid ? value : false;
}

export async function verifyPipeline(
	key: string | CryptoKey | Promise<CryptoKey>,
	signedValue?: string,
) {
	if (!signedValue) {
		return Promise.resolve(false as const);
	}

	let crypto_key: CryptoKey;

	if (key instanceof Promise) {
		crypto_key = await key;
	} else if (key instanceof CryptoKey) {
		crypto_key = key;
	} else {
		crypto_key = await importKey(key);
	}

	return await verifyValue(crypto_key, signedValue);
}
