// Run with: npm test   (uses Node's built-in test runner, no extra packages)
const test = require('node:test');
const assert = require('node:assert');
const { isGarbagePost, cleanRoundType, pickCompany, getLeetCodeSlug } = require('../helpers');

const longText = (text) => text + ' Some more text so the post is long enough.'.repeat(4);

test('drops very short posts', () => {
  assert.strictEqual(isGarbagePost('Stripe OA', 'too short'), true);
});

test('keeps a real interview experience', () => {
  const content = longText('Round 1 was DSA. The interviewer asked Daily Temperatures.');
  assert.strictEqual(isGarbagePost('Airtel SDE-1 Interview Experience', content), false);
});

test('drops advice posts', () => {
  const content = longText('I have 4 YOE and I am barely getting interview calls. Is it my CV?');
  assert.strictEqual(isGarbagePost('Need some advice, barely getting calls', content), true);
});

test('"oa" inside other words does not count', () => {
  const content = longText('I put my roadmap on the board and the load was heavy.');
  assert.strictEqual(isGarbagePost('Career update', content), true);
});

test('cleanRoundType fixes LLM labels', () => {
  assert.strictEqual(cleanRoundType('dsa'), 'DSA');
  assert.strictEqual(cleanRoundType('System Design'), 'HLD');
  assert.strictEqual(cleanRoundType('random'), 'OTHER');
  assert.strictEqual(cleanRoundType(null), 'OTHER');
});

test('pickCompany prefers the LLM company and skips junk names', () => {
  assert.strictEqual(pickCompany('Goldman Sachs', 'Technical Interview'), 'Goldman Sachs');
  assert.strictEqual(pickCompany('Unknown', 'Amazon'), 'Amazon');
  assert.strictEqual(pickCompany(null, 'Technical Interview'), 'Unknown');
});

test('getLeetCodeSlug reads the slug from a LeetCode URL', () => {
  assert.strictEqual(getLeetCodeSlug('https://leetcode.com/problems/two-sum/'), 'two-sum');
  assert.strictEqual(getLeetCodeSlug('https://www.geeksforgeeks.org/two-sum/'), null);
  assert.strictEqual(getLeetCodeSlug(undefined), null);
});
