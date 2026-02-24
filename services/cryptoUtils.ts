// Utilities for handling ArrayBuffer <-> Base64 conversion
export const bufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

export const base64ToBuffer = (base64: string): ArrayBuffer => {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
};

// Generate a random salt
export const generateSalt = (): string => {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  return bufferToBase64(salt.buffer);
};

// Derive a CryptoKey from a password and salt using PBKDF2
export const deriveKey = async (password: string, saltBase64: string): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64ToBuffer(saltBase64),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, // Key MUST be extractable for session persistence
    ["encrypt", "decrypt"]
  );
};

export const exportKeyToJWK = async (key: CryptoKey): Promise<JsonWebKey> => {
  return await window.crypto.subtle.exportKey("jwk", key);
};

export const importKeyFromJWK = async (jwk: JsonWebKey): Promise<CryptoKey> => {
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
};

// Encrypt data using AES-GCM
export const encryptData = async (data: any, key: CryptoKey): Promise<{ iv: string; ciphertext: string }> => {
  const enc = new TextEncoder();
  const encodedData = enc.encode(JSON.stringify(data));
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Standard IV size for GCM

  const encryptedContent = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    encodedData
  );

  return {
    iv: bufferToBase64(iv.buffer),
    ciphertext: bufferToBase64(encryptedContent)
  };
};

// Decrypt data using AES-GCM
export const decryptData = async (ivBase64: string, ciphertextBase64: string, key: CryptoKey): Promise<any> => {
  const iv = base64ToBuffer(ivBase64);
  const ciphertext = base64ToBuffer(ciphertextBase64);

  try {
    const decryptedContent = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decryptedContent));
  } catch (e) {
    throw new Error("Decryption failed. Invalid password or corrupted data.");
  }
};