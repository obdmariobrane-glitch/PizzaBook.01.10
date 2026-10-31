#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexPath = path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx');
const source = fs.readFileSync(indexPath, 'utf8');
const languages = ['hr', 'en', 'de', 'sl'];
const restriction = source.match(
  /\{isProEffectivelyGlutenFree \? <Text style=\{styles\.hint\}>\{\(\{([\s\S]*?)\}\[lang\]\)\}<\/Text> : null\}/,
);
assert.ok(restriction, 'PRO gluten-free method restriction must be localized');
const copy = Object.fromEntries(
  [...restriction[1].matchAll(/(hr|en|de|sl):\s*'([^']+)'/g)].map(([, lang, text]) => [lang, text]),
);
for (const lang of languages) {
  assert.ok(copy[lang], `missing localized restriction for ${lang}`);
  assert.match(copy[lang], /direct|direkt/i, `${lang} must explain the Direct-only restriction`);
  if (lang !== 'hr') {
    assert.doesNotMatch(copy[lang], /brašno|dostupna je samo direktna metoda/i, `${lang} must not leak Croatian text`);
  }
}
assert.match(source, /methodExpanded && !isBeginner/, 'the localized restriction must remain PRO-only');

console.log('F19 PRO gluten-free method restriction localization passed for HR/EN/DE/SL.');
