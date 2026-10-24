import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyVisitorSource } from './siteAnalytics';
test('campaign tags and referrer domains classify sources without accepting spoofed hosts or collecting raw values', () => {
 for (const [href, ref, expected] of [
  ['https://site.example/?utm_source=facebook','','facebook'],['https://site.example/?utm_source=wa','','whatsapp'],
  ['https://site.example/','https://l.facebook.com/path?private=value','facebook'],['https://site.example/','https://facebook.com.evil.example','other'],
  ['https://site.example/','https://web.whatsapp.com/','whatsapp'],['https://site.example/','https://www.google.com/search?q=private','search'],
  ['https://site.example/','https://site.example/offers','direct'],['https://site.example/','','direct'],
  ['https://site.example/?utm_source=custom-private-value','','other'],['https://site.example/?utm_source=facebook','https://www.google.com','facebook'],
 ]) assert.equal(classifyVisitorSource(href,ref),expected);
});
