import crypto from 'crypto';
import { ENCRYPTION_KEY } from './config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

// Validate encryption key on module load
if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required');
}

function getEncryptionKey(): string {
  return ENCRYPTION_KEY;
}

export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();

  // Decode from base64
  const buffer = Buffer.from(encryptedData, 'base64');

  // Extract salt, IV, tag, and encrypted data
  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = buffer.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + TAG_LENGTH
  );
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  // Derive key from password
  const derivedKey = crypto.pbkdf2Sync(
    key,
    salt,
    ITERATIONS,
    KEY_LENGTH,
    'sha512'
  );

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(tag);

  // Decrypt
  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
