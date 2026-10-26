
const {
  describe,
  it,
  beforeEach,
  after,
} = require('node:test');

const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const tempDir = path.join(
  os.tmpdir(),
  `ipp-storage-test-${process.pid}`
);

process.env.UPLOAD_DIR = tempDir;
process.env.RESUME_ENCRYPTION_KEY =
  '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
process.env.NODE_ENV = 'test';

const storageService = require('../src/services/storageService');

describe('resume storage encryption (IPP-NF-003)', () => {
  beforeEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(tempDir, { recursive: true });
  });

  after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('encrypts a resume on disk and returns the original bytes when opened', async () => {
    const pdf = Buffer.from('%PDF-1.7\nexample resume\n%%EOF');
    const key = await storageService.save(pdf);
    const stored = await fs.readFile(path.join(tempDir, key));

    assert.notDeepEqual(stored, pdf);
    assert.equal(stored.includes(pdf), false);

    const stream = await storageService.open(key);
    const chunks = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    assert.deepEqual(Buffer.concat(chunks), pdf);
  });

  it('rejects a tampered encrypted resume', async () => {
    const key = await storageService.save(
      Buffer.from('%PDF-1.7\nresume\n%%EOF')
    );

    const filePath = path.join(tempDir, key);
    const stored = await fs.readFile(filePath);

    stored[stored.length - 1] ^= 0xff;
    await fs.writeFile(filePath, stored);

    await assert.rejects(storageService.open(key));
  });

  it('rejects an encrypted file whose format marker has been altered', async () => {
    const key = await storageService.save(
      Buffer.from('%PDF-1.7\nresume\n%%EOF')
    );

    const filePath = path.join(tempDir, key);
    const stored = await fs.readFile(filePath);

    stored[0] ^= 0xff;
    await fs.writeFile(filePath, stored);

    await assert.rejects(
      storageService.open(key),
      /Resume storage format is invalid/
    );
  });

  it('continues to read an existing plaintext resume', async () => {
    const pdf = Buffer.from('%PDF-1.7\nlegacy resume\n%%EOF');
    const key = `${'a'.repeat(32)}.pdf`;

    await fs.writeFile(path.join(tempDir, key), pdf);

    const stream = await storageService.open(key);
    const chunks = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    assert.deepEqual(Buffer.concat(chunks), pdf);
  });
});
