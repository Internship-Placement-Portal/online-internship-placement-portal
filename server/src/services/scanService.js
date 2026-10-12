const net = require('net');
const config = require('../config/env');
const logger = require('../utils/logger');

// IPP-SR-005: every upload is scanned before it is stored. Scanners are pluggable hooks:
//   async (buffer) => ({ clean: boolean, reason?: string })
// The built-in heuristic scanner blocks PDFs carrying active content. If CLAMAV_HOST is set, a ClamAV
// daemon (clamd INSTREAM) is added to the chain. Any scanner that throws fails closed (upload rejected).

// Active-content markers that have no place in a resume.
const ACTIVE_CONTENT = [/\/JavaScript/i, /\/JS\b/, /\/Launch\b/, /\/EmbeddedFile/i, /\/RichMedia/i];

async function heuristicScanner(buffer) {
  const text = buffer.toString('latin1');
  const hit = ACTIVE_CONTENT.find((re) => re.test(text));
  return hit ? { clean: false, reason: 'PDF contains active or embedded content' } : { clean: true };
}

// Minimal clamd client: zINSTREAM with length-prefixed chunks.
function clamdScanner({ host, port, timeoutMs = 8000 }) {
  return (buffer) =>
    new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port });
      let out = '';
      socket.setTimeout(timeoutMs, () => socket.destroy(new Error('clamd timeout')));
      socket.on('error', reject);
      socket.on('data', (d) => {
        out += d.toString();
      });
      socket.on('end', () => {
        if (/OK\0?\s*$/.test(out.trim())) resolve({ clean: true });
        else if (/FOUND/.test(out)) resolve({ clean: false, reason: 'Malware detected' });
        else reject(new Error(`unexpected clamd reply: ${out.trim()}`));
      });
      socket.on('connect', () => {
        socket.write('zINSTREAM\0');
        for (let i = 0; i < buffer.length; i += 64 * 1024) {
          const chunk = buffer.subarray(i, i + 64 * 1024);
          const len = Buffer.alloc(4);
          len.writeUInt32BE(chunk.length);
          socket.write(Buffer.concat([len, chunk]));
        }
        socket.write(Buffer.alloc(4)); // zero-length chunk terminates the stream
      });
    });
}

const scanners = [heuristicScanner];
if (config.clamav.host) scanners.push(clamdScanner(config.clamav));

// Extension point (and test seam): add another scanner to the chain.
const registerScanner = (fn) => {
  scanners.push(fn);
  return () => scanners.splice(scanners.indexOf(fn), 1);
};

async function scan(buffer) {
  for (const scanner of scanners) {
    try {
      const result = await scanner(buffer);
      if (!result.clean) return result;
    } catch (err) {
      logger.error('upload scanner failed', { error: err.message });
      return { clean: false, reason: 'Could not verify the file is safe', unavailable: true };
    }
  }
  return { clean: true };
}

module.exports = { scan, registerScanner, heuristicScanner, clamdScanner };
