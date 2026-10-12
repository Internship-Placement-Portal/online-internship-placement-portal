const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/env');

// Local-disk storage behind a tiny interface (save / open / remove) so cloud storage can replace it later (SRS 3.3).
// Callers only ever see opaque keys, never filesystem paths; clients never choose where a file is written.
const KEY_RE = /^[a-f0-9]{32}\.pdf$/;

const pathFor = (key) => {
  if (!KEY_RE.test(key)) throw new Error('Invalid storage key');
  return path.join(config.upload.dir, key);
};

async function save(buffer) {
  await fsp.mkdir(config.upload.dir, { recursive: true });
  const key = `${crypto.randomBytes(16).toString('hex')}.pdf`;
  await fsp.writeFile(pathFor(key), buffer, { flag: 'wx' });
  return key;
}

const open = (key) => fs.createReadStream(pathFor(key));
// Unknown / malformed keys simply do not exist (never throw into the request).
const exists = (key) => (KEY_RE.test(String(key)) ? fsp.access(pathFor(key)).then(() => true, () => false) : Promise.resolve(false));
const remove = (key) => fsp.rm(pathFor(key), { force: true });

module.exports = { save, open, exists, remove };
