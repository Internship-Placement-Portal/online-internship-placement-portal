// Tiny Jest-style matcher set on top of node:assert (Jest's vm sandbox breaks the MongoDB driver handshake,
// so the suite runs on Node's built-in test runner).
const assert = require('node:assert/strict');

function matchObject(actual, expected) {
  for (const [k, v] of Object.entries(expected)) assert.deepEqual(actual[k], v);
}

function expect(actual) {
  const api = {
    toBe: (e) => assert.equal(actual, e),
    toEqual: (e) => assert.deepEqual(actual, e),
    toMatchObject: (e) => matchObject(actual, e),
    toBeDefined: () => assert.notEqual(actual, undefined),
    toBeUndefined: () => assert.equal(actual, undefined),
    toMatch: (re) => assert.match(String(actual), re),
    toContain: (s) => assert.ok(String(actual).includes(s), `expected value to contain ${s}`),
  };
  api.not = {
    toBe: (e) => assert.notEqual(actual, e),
    toContain: (s) => assert.ok(!String(actual).includes(s), `expected value not to contain ${s}`),
  };
  return api;
}

module.exports = expect;
