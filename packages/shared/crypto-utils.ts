import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

// Validate encryption key on module load
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required');
}

function getEncryptionKey(): string {
  return ENCRYPTION_KEY!;
}

export function encrypt(text: string): string {
  const key = getEncryptionKey();

  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derive key from password using PBKDF2
  const derivedKey = crypto.pbkdf2Sync(
    key,
    salt,
    ITERATIONS,
    KEY_LENGTH,
    'sha512'
  );

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);

  // Encrypt the text
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get auth tag
  const tag = cipher.getAuthTag();

  // Combine salt + iv + tag + encrypted
  const result = Buffer.concat([
    salt,
    iv,
    tag,
    Buffer.from(encrypted, 'hex')
  ]);

  return result.toString('base64');
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

/**
 * Generate a unique hash combining timestamp and random characters
 * Format: YYYYMMDDHHMMSS-XXXXXX (e.g., 20251029143025-a3f9b2)
 * Used for creating unique repository names in GitLab
 */
export function generateRepositoryHash(): string {
  const now = new Date();

  // Generate timestamp: YYYYMMDDHHMMSS
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');

  // Generate random 6-character hex string
  const randomHash = crypto.randomBytes(3).toString('hex');

  return `${timestamp}-${randomHash}`;
}
