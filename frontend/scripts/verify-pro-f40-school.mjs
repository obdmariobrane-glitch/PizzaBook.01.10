import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');

function loadTypeScriptModule(source, filename, dependencies = {}) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRef = { exports: {} };
  const require = (specifier) => {
    if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
    throw new Error(`Unexpected dependency "${specifier}" in ${filename}.`);
  };
  vm.runInNewContext(compiled, { module: moduleRef, exports: moduleRef.exports, require }, { filename });
  return moduleRef.exports;
}

function loadFile(relativePath, dependencies) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  return loadTypeScriptModule(source, path.basename(relativePath), dependencies);
}

const hr = loadFile('src/proLearn/manualContent.generated.ts').PRO_LEARN_HR;
const en = loadFile('src/proLearn/manualContent.en.ts', {
  './manualContent.en.part1': loadFile('src/proLearn/manualContent.en.part1.ts'),
  './manualContent.en.part2': loadFile('src/proLearn/manualContent.en.part2.ts'),
  './manualContent.en.part3': loadFile('src/proLearn/manualContent.en.part3.ts'),
}).PRO_LEARN_EN;
const de = loadFile('src/proLearn/manualContent.de.ts', {
  './manualContent.de.part1': loadFile('src/proLearn/manualContent.de.part1.ts'),
  './manualContent.de.part2': loadFile('src/proLearn/manualContent.de.part2.ts'),
  './manualContent.de.part3': loadFile('src/proLearn/manualContent.de.part3.ts'),
}).PRO_LEARN_DE;
const sl = loadFile('src/proLearn/manualContent.sl.ts', {
  './manualContent.sl.part1': loadFile('src/proLearn/manualContent.sl.part1.ts'),
  './manualContent.sl.part2': loadFile('src/proLearn/manualContent.sl.part2.ts'),
  './manualContent.sl.part3': loadFile('src/proLearn/manualContent.sl.part3.ts'),
}).PRO_LEARN_SL;
const manuals = loadFile('src/proLearn/manuals.ts', {
  './manualContent.de': { PRO_LEARN_DE: de },
  './manualContent.en': { PRO_LEARN_EN: en },
  './manualContent.generated': { PRO_LEARN_HR: hr },
  './manualContent.sl': { PRO_LEARN_SL: sl },
});
const { findProLearnAnchor, PRO_LEARN_MANUALS } = manuals;
const translations = loadFile('src/i18n/translations.ts').translations;
const locales = { hr, en, de, sl };
const stableTextIds = (manual) => Array.from(manual.topics).flatMap((topic) => [
  topic.id,
  ...Array.from(topic.sections, (section) => section.id),
]);
const wordCount = (value) => value.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;

assert.deepEqual(Object.keys(PRO_LEARN_MANUALS), ['hr', 'en', 'de', 'sl']);
assert.equal(hr.topics.length, 18);

const expectedTopicIds = Array.from(hr.topics, (topic) => topic.id);
const expectedSectionCount = Array.from(hr.topics).reduce((count, topic) => count + topic.sections.length, 0);
assert.equal(expectedSectionCount, 79);
const expectedSectionIds = Array.from(
hr.topics,
(topic) => Array.from(topic.sections, (section) => section.id),
);
const expectedLevels = Array.from(
hr.topics,
(topic) => Array.from(topic.sections, (section) => section.level),
);

for (const lang of ['hr', 'en', 'de', 'sl']) {
  const manual = PRO_LEARN_MANUALS[lang];
  assert.ok(manual, `${lang} manual is required`);
  assert.equal(manual.locale, lang, `${lang} locale marker`);
  assert.equal(manual.topics.length, 18, `${lang} has all 18 topics`);
  assert.ok(manual.title.trim(), `${lang} manual title`);
  assert.ok(manual.introduction.trim(), `${lang} manual introduction`);
  if (lang !== 'hr') {
    assert.notEqual(manual.title, hr.title, `${lang} manual title must be translated`);
    assert.notEqual(manual.introduction, hr.introduction, `${lang} manual introduction must be translated`);
  }

  assert.deepEqual(
    Array.from(manual.topics, (topic) => topic.id),
    expectedTopicIds,
    `${lang} topic order and IDs`,
  );
  assert.deepEqual(
    Array.from(manual.topics, (topic) => Array.from(topic.sections, (section) => section.id)),
    expectedSectionIds,
    `${lang} section order and IDs`,
  );
  assert.deepEqual(
    Array.from(manual.topics, (topic) => Array.from(topic.sections, (section) => section.level)),
    expectedLevels,
    `${lang} section nesting levels`,
  );
  assert.equal(new Set(stableTextIds(manual)).size, stableTextIds(manual).length, `${lang} IDs are unique`);

  const validAnchors = new Set(stableTextIds(manual));
  for (let topicIndex = 0; topicIndex < manual.topics.length; topicIndex += 1) {
    const topic = manual.topics[topicIndex];
    const hrTopic = hr.topics[topicIndex];
    assert.ok(topic.title.trim(), `${lang} ${topic.id} title`);
    assert.ok(topic.description.trim(), `${lang} ${topic.id} description`);
    if (hrTopic.introduction) assert.ok(topic.introduction.trim(), `${lang} ${topic.id} introduction`);
    else assert.equal(topic.introduction, '', `${lang} ${topic.id} keeps the canonical empty introduction`);
    if (lang !== 'hr') {
      assert.notEqual(topic.description, hrTopic.description, `${lang} ${topic.id} description must be translated`);
      if (hrTopic.introduction) assert.notEqual(topic.introduction, hrTopic.introduction, `${lang} ${topic.id} introduction`);
    }

    for (let sectionIndex = 0; sectionIndex < topic.sections.length; sectionIndex += 1) {
      const section = topic.sections[sectionIndex];
      const hrSection = hrTopic.sections[sectionIndex];
      assert.ok(section.title.trim(), `${lang} ${section.id} title`);
      if (hrSection.markdown.trim()) {
        assert.ok(section.markdown.trim(), `${lang} ${section.id} body`);
      } else {
        assert.equal(section.markdown, '', `${lang} ${section.id} preserves the canonical empty container`);
      }
      if (lang !== 'hr') {
        if (hrSection.markdown.trim()) {
          assert.notEqual(section.markdown, hrSection.markdown, `${lang} ${section.id} body must be translated`);
        }
        const sourceWords = wordCount(hrSection.markdown);
        if (sourceWords >= 40) {
          assert.ok(
            wordCount(section.markdown) >= sourceWords * 0.55,
            `${lang} ${section.id} body is too short to be a full translation`,
          );
        }
        const sourceParagraphs = hrSection.markdown.trim().split(/\n\s*\n/).length;
        const localizedParagraphs = section.markdown.trim().split(/\n\s*\n/).length;
        assert.equal(localizedParagraphs, sourceParagraphs, `${lang} ${section.id} paragraph structure`);
        for (const [label, pattern] of [
          ['table rows', /^\s*\|/gm],
          ['ordered-list items', /^\s*\d+\.\s/gm],
          ['bullet items', /^\s*[-*]\s/gm],
          ['blockquote rows', /^\s*>\s?/gm],
        ]) {
          const sourceCount = hrSection.markdown.match(pattern)?.length ?? 0;
          const localizedCount = section.markdown.match(pattern)?.length ?? 0;
          assert.equal(localizedCount, sourceCount, `${lang} ${section.id} ${label} structure`);
        }
      }
      const internalLinks = [...section.markdown.matchAll(/\]\(#([^)]+)\)/g)];
      const sourceAnchors = [...hrSection.markdown.matchAll(/\]\(#([^)]+)\)/g)].map(([, anchor]) => anchor);
      assert.deepEqual(internalLinks.map(([, anchor]) => anchor), sourceAnchors, `${lang} ${section.id} link anchors`);
      for (const [, anchor] of internalLinks) {
        const decodedAnchor = decodeURIComponent(anchor);
        assert.ok(validAnchors.has(decodedAnchor), `${lang} ${section.id} link target #${decodedAnchor} exists`);
        assert.ok(findProLearnAnchor(manual, decodedAnchor), `${lang} ${section.id} link target #${decodedAnchor} navigates`);
      }
    }
  }
}

for (const lang of ['hr', 'en', 'de', 'sl']) {
  for (const key of ['back', 'backToTopics', 'contents', 'openTopic', 'topicNotFound']) {
    assert.ok(translations[lang].common[key].trim(), `${lang} UI label ${key} exists`);
    if (lang !== 'hr') {
      assert.notEqual(translations[lang].common[key], translations.hr.common[key], `${lang} UI label ${key} is localized`);
    }
  }
}

for (const lang of ['en', 'de', 'sl']) {
  const manual = locales[lang];
  const localizedText = [
    manual.title,
    manual.introduction,
    ...manual.topics.flatMap((topic) => [
      topic.title,
      topic.description,
      topic.introduction,
      ...topic.sections.flatMap((section) => [section.title, section.markdown]),
    ]),
  ].join('\n');
  assert.doesNotMatch(
    localizedText,
    /Kako postati Pro|Praktičan PizzaBook vodič|Sadržaj teme|Česta pogreška|Što promatrati/,
    `${lang} contains no obvious Croatian fallback`,
  );
  if (lang === 'de') {
    assert.doesNotMatch(
      localizedText,
      /\bPolieren\b|\bWaffeln\b|\bTeglio\b|\bBowlen\b|\bFlüssigkeitszufuhr\b|\bBäckerprozentsätze und Budget\b/,
      'German pizza terminology is not mistranslated',
    );
  }
}

for (const [route, fallback] of [
  ['app/pro-guide/index.tsx', 'LegacySchoolPage'],
  ['app/pro-guide/[topicId].tsx', 'LegacySchoolPage'],
]) {
  const source = fs.readFileSync(path.join(root, route), 'utf8');
  assert.doesNotMatch(source, new RegExp(fallback), `${route} does not route to the 8-rule fallback`);
}

const topicRoute = fs.readFileSync(path.join(root, 'app/pro-guide/[topicId].tsx'), 'utf8');
assert.match(topicRoute, /t\.common\.topicNotFound/, 'topic-not-found label is localized');

console.log('F40 PRO School coverage passed: 18 topics, all section/navigation IDs, HR/EN/DE/SL.');
