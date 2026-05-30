import { encrypt, decrypt, getMachineKey } from './crypto-utils';

describe('CryptoUtils', () => {
  test('encrypt and decrypt roundtrip', () => {
    const plaintext = 'sk-test-api-key-12345';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  test('different encryptions produce different ciphertexts (random IV)', () => {
    const plaintext = 'same-key';
    const e1 = encrypt(plaintext);
    const e2 = encrypt(plaintext);
    expect(e1).not.toBe(e2);
  });

  test('getMachineKey returns a consistent key', () => {
    const key1 = getMachineKey();
    const key2 = getMachineKey();
    expect(key1).toEqual(key2);
  });

  test('decrypt with tampered data throws', () => {
    expect(() => decrypt('invalid:format:here')).toThrow();
  });

  test('handles empty string', () => {
    const encrypted = encrypt('');
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe('');
  });

  test('handles special characters', () => {
    const plaintext = 'sk-ant-!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });
});
