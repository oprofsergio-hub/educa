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
  assert.strictEqual(EducaFlowPro.determineSuspensionDuration(0, 2), 2);
  assert.strictEqual(EducaFlowPro.determineSuspensionDuration(1, 2), 4);
  assert.strictEqual(EducaFlowPro.determineSuspensionDuration(2, 2), 5);
  assert.strictEqual(EducaFlowPro.determineSuspensionDuration(0, 3), 3);
  assert.strictEqual(EducaFlowPro.determineSuspensionDuration(1, 3), 5);
});

test('evaluateSuspensionTrigger suggests suspension for leve accumulation', () => {
  const app = new EducaFlowPro({ autoInit: false });
  const result = app.evaluateSuspensionTrigger({
    leveCount: 3,
    mediaCount: 0,
    graveCount: 0,
    issuedSuspensions: 0,
  });

  assert.ok(result.shouldSuggest);
  assert.strictEqual(result.baseDuration, 1);
  assert.strictEqual(result.suggestedDuration, 1);
  assert.match(result.reason, /3 infrações leves/);
});

test('evaluateSuspensionTrigger prioritises higher severity combinations', () => {
  const app = new EducaFlowPro({ autoInit: false });
  const result = app.evaluateSuspensionTrigger({
    leveCount: 1,
    mediaCount: 2,
    graveCount: 0,
    issuedSuspensions: 1,
  });

  assert.ok(result.shouldSuggest);
  assert.strictEqual(result.baseDuration, 2);
  assert.strictEqual(result.suggestedDuration, 4);
  assert.match(result.reason, /infrações médias/);
});

test('updateSuspensionCounters re-triggers suggestion when counts grow while awaiting report', async () => {
  const app = new EducaFlowPro({ autoInit: false });
  app.isDemoMode = true;
  app.demoData = { suspensionTrackers: {} };
  app.suspensionTrackers = new Map();

  const first = await app.updateSuspensionCounters({ id: null, name: 'Aluno Teste' }, 'grave');
  assert.ok(first.shouldSuggest);
  assert.strictEqual(first.tracker.graveCount, 1);

  const second = await app.updateSuspensionCounters({ id: null, name: 'Aluno Teste' }, 'grave');
  assert.ok(second.shouldSuggest);
  assert.strictEqual(second.tracker.graveCount, 2);
  assert.strictEqual(second.matchedCounts.grave, 2);
});

test('generateSuspensionPdf returns false when jsPDF is unavailable', async () => {
  const originalJsPdf = global.window.jspdf;
  delete global.window.jspdf;

  const app = new EducaFlowPro({ autoInit: false });
  app.showToast = () => {};

  const result = await app.generateSuspensionPdf({
    studentName: 'Aluno Teste',
    className: '7º A',
    reason: 'Regra acionada',
    durationDays: 3,
    letterText: 'Teste de suspensão.',
    summary: { leve: 0, media: 0, grave: 1, total: 1 },
  });

  assert.strictEqual(result, false);

  if (originalJsPdf !== undefined) {
    global.window.jspdf = originalJsPdf;
  } else {
    delete global.window.jspdf;
  }
});

test('formatTimeSlot maps minutes to half-hour windows', () => {
  assert.strictEqual(EducaFlowPro.formatTimeSlot('07:15'), '07:00 - 07:29');
  assert.strictEqual(EducaFlowPro.formatTimeSlot('07:45'), '07:30 - 07:59');
  assert.strictEqual(EducaFlowPro.formatTimeSlot('23:10'), '23:00 - 23:29');
  assert.strictEqual(EducaFlowPro.formatTimeSlot('invalid'), null);
});
