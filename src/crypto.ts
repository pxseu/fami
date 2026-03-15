export function importKey(key: string | CryptoKey): Promise<CryptoKey> {
	if (key instanceof CryptoKey) {
		return Promise.resolve(key);
	}

	return crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(key),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

export async function signValue(
	key: CryptoKey,
	value: string,
): Promise<string> {
	const digest = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(value),
	);

	const sig = new Uint8Array(digest).toBase64({
		alphabet: "base64url",
	});

	return `${value}.${sig}`;
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
	const lastDotIndex = signedValue.lastIndexOf(".");
	if (lastDotIndex === -1) {
		return false;
	}

	const value = signedValue.slice(0, lastDotIndex);
	const sig = signedValue.slice(lastDotIndex + 1);

	const bytes = Uint8Array.fromBase64(sig, {
		alphabet: "base64url",
	});

	const valid = await crypto.subtle.verify(
		"HMAC",
		key,
		bytes,
		new TextEncoder().encode(value),
	);

	return valid ? value : false;
}

export async function verifyPipeline(
	key: string | CryptoKey | Promise<CryptoKey>,
	signedValue: string,
) {
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
