const net = require('net');
const { describe, it } = require('node:test');
const expect = require('./expect');
const { clamdScanner, heuristicScanner } = require('../src/services/scanService');

// Fake clamd: reads until the zero-length INSTREAM terminator, then answers.
function fakeClamd(reply) {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      let buf = Buffer.alloc(0);
      socket.on('data', (d) => {
        buf = Buffer.concat([buf, d]);
        if (buf.subarray(-4).equals(Buffer.alloc(4))) socket.end(reply);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

describe('upload scanners (IPP-SR-005)', () => {
  it('heuristic scanner flags active content and passes plain PDFs', async () => {
    expect((await heuristicScanner(Buffer.from('%PDF-1.4 /JavaScript %%EOF'))).clean).toBe(false);
    expect((await heuristicScanner(Buffer.from('%PDF-1.4 plain text %%EOF'))).clean).toBe(true);
  });

  it('clamd scanner reports clean files', async () => {
    const server = await fakeClamd('stream: OK\0');
    const result = await clamdScanner({ host: '127.0.0.1', port: server.address().port })(Buffer.from('%PDF-1.4 hello %%EOF'));
    server.close();
    expect(result.clean).toBe(true);
  });

  it('clamd scanner reports infected files', async () => {
    const server = await fakeClamd('stream: Eicar-Test-Signature FOUND\0');
    const result = await clamdScanner({ host: '127.0.0.1', port: server.address().port })(Buffer.from('X'));
    server.close();
    expect(result.clean).toBe(false);
  });

  it('clamd scanner rejects (fails closed upstream) when the daemon is unreachable', async () => {
    let failed = false;
    await clamdScanner({ host: '127.0.0.1', port: 1 })(Buffer.from('X')).catch(() => {
      failed = true;
    });
    expect(failed).toBe(true);
  });
});
