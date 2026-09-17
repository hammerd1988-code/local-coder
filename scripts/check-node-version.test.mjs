import assert from 'node:assert/strict';
import test from 'node:test';

import { minimumNodeVersion, supportsNodeVersion } from './check-node-version.mjs';

test('accepts the minimum supported Node release', () => {
  assert.equal(minimumNodeVersion, '22.12.0');
  assert.equal(supportsNodeVersion('v22.12.0'), true);
});

test('rejects Node releases below the effective dependency minimum', () => {
  assert.equal(supportsNodeVersion('22.11.99'), false);
  assert.equal(supportsNodeVersion('20.19.0'), false);
});

test('accepts newer supported Node releases', () => {
  assert.equal(supportsNodeVersion('22.23.2'), true);
  assert.equal(supportsNodeVersion('24.19.0'), true);
});

test('rejects malformed version strings', () => {
  assert.equal(supportsNodeVersion('22'), false);
  assert.equal(supportsNodeVersion('unknown'), false);
});
