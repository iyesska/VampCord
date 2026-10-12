/*
 * VampCord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// End to end encryption for messages using a shared passphrase.
//
// The passphrase is stretched with PBKDF2 into 512 bits: the first half is the AES-256-GCM key, the second half is
// hashed into a short key id. Messages carry that id so the right passphrase can be picked without trying them all.
// Every message uses a random 96 bit IV, and GCM authenticates the ciphertext so tampering is detected.

const VERSION = "v1";
const ITERATIONS = 310_000;
const SALT = new TextEncoder().encode("VampCord SecretMessages v1");

export const TOKEN_REGEX = /vamp:v1:([0-9a-f]{8}):([A-Za-z0-9_-]{24,})/;

/**
 * Discord allows 2000 characters per message. Ciphertext grows with the UTF-8 size of the text (emojis take 4 bytes),
 * so the limit is in bytes and leaves room for the encryption overhead
 */
export const MAX_PLAINTEXT_BYTES = 1350;

export const utf8Length = (text: string) => new TextEncoder().encode(text).length;

interface DerivedKey {
    id: string;
    key: CryptoKey;
}

const keyCache = new Map<string, Promise<DerivedKey>>();

function toBase64Url(bytes: Uint8Array) {
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(str: string) {
    const binary = atob(str.replaceAll("-", "+").replaceAll("_", "/"));
    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function toHex(bytes: Uint8Array) {
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

async function derive(passphrase: string): Promise<DerivedKey> {
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(await crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt: SALT, iterations: ITERATIONS },
        material,
        512
    ));

    const key = await crypto.subtle.importKey("raw", bits.slice(0, 32), "AES-GCM", false, ["encrypt", "decrypt"]);
    const idHash = new Uint8Array(await crypto.subtle.digest("SHA-256", bits.slice(32)));

    return { key, id: toHex(idHash.slice(0, 4)) };
}

/** Derives (and caches) the key for a passphrase. Deriving is intentionally slow to make guessing passphrases expensive */
export function deriveKey(passphrase: string) {
    let derived = keyCache.get(passphrase);
    if (!derived) {
        derived = derive(passphrase);
        keyCache.set(passphrase, derived);
        // Don't cache failures
        derived.catch(() => keyCache.delete(passphrase));
    }
    return derived;
}

export async function getKeyId(passphrase: string) {
    return (await deriveKey(passphrase)).id;
}

/** Encrypts text into a token like vamp:v1:<key id>:<iv + ciphertext> */
export async function encrypt(text: string, passphrase: string) {
    if (!passphrase) throw new Error("No passphrase set");

    const { key, id } = await deriveKey(passphrase);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(`${VERSION}:${id}`) },
        key,
        new TextEncoder().encode(text)
    ));

    const payload = new Uint8Array(iv.length + ciphertext.length);
    payload.set(iv);
    payload.set(ciphertext, iv.length);

    return `vamp:${VERSION}:${id}:${toBase64Url(payload)}`;
}

export function findToken(content: string | undefined) {
    const match = content?.match(TOKEN_REGEX);
    return match ? { keyId: match[1], payload: match[2] } : null;
}

export type DecryptResult =
    | { status: "decrypted"; text: string; }
    | { status: "no-key"; keyId: string; }
    | { status: "invalid"; };

/** Decrypts the secret message in content with whichever of the passphrases it was encrypted with */
export async function decrypt(content: string, passphrases: string[]): Promise<DecryptResult | null> {
    const token = findToken(content);
    if (!token) return null;

    for (const passphrase of new Set(passphrases)) {
        if (!passphrase) continue;

        const { key, id } = await deriveKey(passphrase);
        if (id !== token.keyId) continue;

        try {
            const payload = fromBase64Url(token.payload);
            const plaintext = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: payload.slice(0, 12), additionalData: new TextEncoder().encode(`${VERSION}:${id}`) },
                key,
                payload.slice(12)
            );
            return { status: "decrypted", text: new TextDecoder().decode(plaintext) };
        } catch {
            return { status: "invalid" };
        }
    }

    return { status: "no-key", keyId: token.keyId };
}

/** A random passphrase that is easy to share, eg "mabu-kite-roso-pelu-nadi-tova" (~75 bits) */
export function generatePassphrase(words = 6) {
    const consonants = "bdfghklmnprstvz";
    const vowels = "aeiou";
    const random = (max: number) => {
        const buf = new Uint32Array(1);
        const limit = 2 ** 32 - (2 ** 32 % max);
        do crypto.getRandomValues(buf); while (buf[0] >= limit);
        return buf[0] % max;
    };
    const syllable = () => consonants[random(consonants.length)] + vowels[random(vowels.length)];

    return Array.from({ length: words }, () => syllable() + syllable()).join("-");
}
