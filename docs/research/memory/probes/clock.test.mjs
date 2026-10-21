import { test, mock } from 'node:test';
import assert from 'node:assert';
test('mock Date and setInterval advance together', () => {
  mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: Date.parse('2026-01-01T00:00:00Z') });
  let ticks = 0; setInterval(() => ticks++, 1000);
  mock.timers.tick(7 * 24 * 3600 * 1000);
  assert.equal(new Date().toISOString(), '2026-01-08T00:00:00.000Z');
  assert.equal(ticks, 7 * 24 * 3600);
  mock.timers.reset();
});
