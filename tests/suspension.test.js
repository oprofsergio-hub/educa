const { test } = require('node:test');
const assert = require('node:assert/strict');

const noop = () => {};

if (!global.window) {
  global.window = {
    navigator: { userAgent: 'node-test-runner' },
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
    addEventListener: noop,
  };
}

if (!global.navigator) {
  global.navigator = global.window.navigator || { userAgent: 'node-test-runner' };
}

if (!global.document) {
  global.document = {
    addEventListener: noop,
    getElementById: () => null,
    querySelectorAll: () => [],
  };
}

const { EducaFlowPro } = require('../app.js');

test('determineSuspensionDuration escalates correctly', () => {
  assert.strictEqual(EducaFlowPro.determineSuspensionDuration(0), 1);
  assert.strictEqual(EducaFlowPro.determineSuspensionDuration(1), 3);
  assert.strictEqual(EducaFlowPro.determineSuspensionDuration(2), 5);
  assert.strictEqual(EducaFlowPro.determineSuspensionDuration(10), 5);
});

test('formatTimeSlot maps minutes to half-hour windows', () => {
  assert.strictEqual(EducaFlowPro.formatTimeSlot('07:15'), '07:00 - 07:29');
  assert.strictEqual(EducaFlowPro.formatTimeSlot('07:45'), '07:30 - 07:59');
  assert.strictEqual(EducaFlowPro.formatTimeSlot('23:10'), '23:00 - 23:29');
  assert.strictEqual(EducaFlowPro.formatTimeSlot('invalid'), null);
});
