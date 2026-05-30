import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import * as os from 'os';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const SALT = 'MeterChat-Static-Salt-v1';

function getKeyDerivationInput(): string {
  const hostname = os.hostname();
  const username = os.userInfo().username;
  return `${hostname}:${username}:${SALT}`;
}

export function getMachineKey(): Buffer {
  const input = getKeyDerivationInput();
  return scryptSync(input, SALT, KEY_LENGTH);
}

export function encrypt(plaintext: string): string {
  const key = getMachineKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');

  return `${iv.toString('base64')}:${ciphertext}:${authTag}`;
}

export function decrypt(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [ivB64, ciphertextB64, authTagB64] = parts;
  const key = getMachineKey();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertextB64, 'base64', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
}
