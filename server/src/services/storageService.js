
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { Readable } = require('stream');
const crypto = require('crypto');
const config = require('../config/env');

const KEY_RE = /^[a-f0-9]{32}\.pdf$/;
const FORMAT_MARKER = Buffer.from('IPPENC1:');
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const pathFor = (key) => {
  if (!KEY_RE.test(key)) throw new Error('Invalid storage key');
  return path.join(config.upload.dir, key);
};

function getEncryptionKey() {
  const key = config.upload.encryptionKey;
  if (typeof key !== 'string' || !/^[a-f0-9]{64}$/i.test(key)) {
    throw new Error('Resume encryption key is not configured correctly');
  }
  return Buffer.from(key, 'hex');
}

async function save(buffer) {
  const key = getEncryptionKey();
  await fsp.mkdir(config.upload.dir, { recursive: true });

  const storageKey = `${crypto.randomBytes(16).toString('hex')}.pdf`;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(buffer),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const encrypted = Buffer.concat([
    FORMAT_MARKER,
    iv,
    tag,
    ciphertext,
  ]);

  await fsp.writeFile(pathFor(storageKey), encrypted, { flag: 'wx' });
  return storageKey;
}

async function open(key) {
  const data = await fsp.readFile(pathFor(key));
// Backward compatibility: previously stored plaintext PDFs remain readable.
  if (!data.subarray(0, FORMAT_MARKER.length).equals(FORMAT_MARKER)) {
    // Accept only recognizable legacy PDF files.
    if (data.subarray(0, 5).toString('ascii') === '%PDF-') {
      return Readable.from(data);
    }

    throw new Error('Resume storage format is invalid');
  }

  const headerLength = FORMAT_MARKER.length + IV_LENGTH + TAG_LENGTH;
  if (data.length < headerLength) {
    throw new Error('Encrypted resume is malformed');
  }

  const offset = FORMAT_MARKER.length;
  const iv = data.subarray(offset, offset + IV_LENGTH);
  const tag = data.subarray(offset + IV_LENGTH, headerLength);
  const ciphertext = data.subarray(headerLength);

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    iv
  );
  decipher.setAuthTag(tag);

  // Authentication must finish before any resume bytes are returned.
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return Readable.from(plaintext);
}

const exists = (key) =>
  KEY_RE.test(String(key))
    ? fsp.access(pathFor(key)).then(() => true, () => false)
    : Promise.resolve(false);

const remove = (key) => fsp.rm(pathFor(key), { force: true });

module.exports = { save, open, exists, remove };
