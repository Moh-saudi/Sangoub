import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCorruptedName, cleanName, cleanCourierName, cleanCustomerName } from './sanitizeName.ts';

test('isCorruptedName accurately identifies question mark strings and corruptions', () => {
  assert.equal(isCorruptedName(undefined), true);
  assert.equal(isCorruptedName(null), true);
  assert.equal(isCorruptedName(''), true);
  assert.equal(isCorruptedName('   '), true);
  assert.equal(isCorruptedName('???????'), true);
  assert.equal(isCorruptedName('???? ???????'), true);
  assert.equal(isCorruptedName('؟؟؟؟ ؟؟؟؟'), true);
  assert.equal(isCorruptedName('??'), true);
  assert.equal(isCorruptedName('???'), true);
  assert.equal(isCorruptedName('احمد??محمد'), true);
  assert.equal(isCorruptedName('احمد محمد'), false);
  assert.equal(isCorruptedName('كابتن أحمد'), false);
  assert.equal(isCorruptedName('Mesk LLC'), false);
  assert.equal(isCorruptedName('El7lm Platform'), false);
});

test('cleanCourierName replaces corrupted courier names with valid Arabic fallbacks', () => {
  assert.equal(cleanCourierName('??????? ?????', '01012345678'), 'كابتن (5678)');
  assert.equal(cleanCourierName('?????? ???', ''), 'كابتن توصيل');
  assert.equal(cleanCourierName(null, null), 'كابتن توصيل');
  assert.equal(cleanCourierName('أحمد محمد', '01012345678'), 'أحمد محمد');
  assert.equal(cleanCourierName('الطيار 1', '01099887766'), 'الطيار 1');
});

test('cleanCustomerName replaces corrupted customer names with valid fallbacks', () => {
  assert.equal(cleanCustomerName('???? ???????', '01122334455'), 'عميل (4455)');
  assert.equal(cleanCustomerName('??????', null, 'customer@example.com'), 'customer');
  assert.equal(cleanCustomerName('??????', null, null), 'عميل سنجوب');
  assert.equal(cleanCustomerName('Mesk LLC', '01122334455'), 'Mesk LLC');
});
