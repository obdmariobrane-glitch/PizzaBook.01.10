const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'PRO-LEARN-HR.md'), 'utf8');
const generatedPath = path.join(__dirname, '../src/proLearn/manualContent.generated.ts');
const generatedText = fs.readFileSync(generatedPath, 'utf8');
const marker = 'export const PRO_LEARN_HR: ProGuideManual = ';
const start = generatedText.indexOf(marker);
assert.notEqual(start, -1, 'Generated manual export is missing');
const jsonStart = start + marker.length;
const jsonEnd = generatedText.lastIndexOf(';');
const manual = JSON.parse(generatedText.slice(jsonStart, jsonEnd));

const sourceTopics = [...source.matchAll(/^## ([A-R])\. (.*?) \{#([^}]+)\}\s*$/gm)];
assert.equal(sourceTopics.length, 18, 'Source must contain 18 A–R topics');
assert.equal(manual.topics.length, 18, 'App manual must contain all 18 topics');
assert.deepEqual(manual.topics.map((topic) => topic.id), sourceTopics.map((topic) => topic[3]));

const ids = [...source.matchAll(/\{#([^}]+)\}/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'All content IDs must be unique');
const idSet = new Set(ids);
const links = [...source.matchAll(/\]\(#([^)]+)\)/g)].map((match) => match[1]);
for (const link of links) assert.ok(idSet.has(link), `Internal link has no target: #${link}`);
assert.ok(!/https?:\/\//.test(source), 'Public manual must not include external URLs');

for (let index = 0; index < sourceTopics.length; index += 1) {
  const heading = sourceTopics[index];
  const end = sourceTopics[index + 1]?.index ?? source.length;
  const body = source.slice(heading.index + heading[0].length, end).trim();
  const sectionHeaders = [...body.matchAll(/^(#{3,4}) (.*?) \{#([^}]+)\}\s*$/gm)];
  const generatedTopic = manual.topics[index];
  assert.equal(generatedTopic.title, heading[2], `Topic title mismatch: ${heading[3]}`);
  assert.ok(generatedTopic.description.trim(), `Missing card description: ${heading[3]}`);
  assert.ok(sectionHeaders.length > 0, `Missing subchapters: ${heading[3]}`);
  assert.deepEqual(generatedTopic.sections.map((section) => section.id), sectionHeaders.map((section) => section[3]));

  const leadingText = body.slice(0, sectionHeaders[0].index)
    .split('\n')
    .filter((line) => !line.startsWith('**Sadržaj teme:**'))
    .join('\n')
    .trim();
  assert.equal(generatedTopic.introduction, leadingText, `Topic introduction mismatch: ${heading[3]}`);

  for (let sectionIndex = 0; sectionIndex < sectionHeaders.length; sectionIndex += 1) {
    const section = sectionHeaders[sectionIndex];
    const sectionStart = section.index + section[0].length;
    const sectionEnd = sectionHeaders[sectionIndex + 1]?.index ?? body.length;
    const expected = body.slice(sectionStart, sectionEnd).trim();
    const actual = generatedTopic.sections[sectionIndex];
    assert.equal(actual.title, section[2], `Subchapter title mismatch: ${actual.id}`);
    assert.equal(actual.markdown, expected, `Subchapter content mismatch: ${actual.id}`);
  }
}

const manualRegistry = fs.readFileSync(path.join(root, 'frontend/src/proLearn/manuals.ts'), 'utf8');
for (const locale of ['en', 'de', 'sl']) {
  assert.match(manualRegistry, new RegExp(`${locale}: null`), `Missing-language marker for ${locale}`);
}
for (const entryFile of ['frontend/app/(tabs)/index.tsx', 'frontend/app/settings.tsx']) {
  const code = fs.readFileSync(path.join(root, entryFile), 'utf8');
  assert.match(code, /router\.push\('\/pro-guide'\)/, `Missing shared manual entry in ${entryFile}`);
}

console.log(`Verified ${manual.topics.length} localized HR topics, ${ids.length} stable IDs, ${links.length} internal links, and exact source-to-app content parity.`);
