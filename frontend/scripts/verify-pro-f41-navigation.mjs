import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');

function loadModule(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduleRef = { exports: {} };
  vm.runInNewContext(compiled, {
    module: moduleRef,
    exports: moduleRef.exports,
    require: (specifier) => {
      if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
      throw new Error(`Unexpected dependency "${specifier}" in ${relativePath}.`);
    },
  }, { filename: relativePath });
  return moduleRef.exports;
}

function loadParts(language) {
  const parts = [1, 2, 3].map((part) => loadModule(`src/proLearn/manualContent.${language}.part${part}.ts`));
  return loadModule(`src/proLearn/manualContent.${language}.ts`, Object.fromEntries(
    parts.map((value, index) => [`./manualContent.${language}.part${index + 1}`, value]),
  ))[`PRO_LEARN_${language.toUpperCase()}`];
}

const manuals = {
  hr: loadModule('src/proLearn/manualContent.generated.ts').PRO_LEARN_HR,
  en: loadParts('en'),
  de: loadParts('de'),
  sl: loadParts('sl'),
};
const { findProLearnAnchor } = loadModule('src/proLearn/manuals.ts', {
  './manualContent.de': { PRO_LEARN_DE: manuals.de },
  './manualContent.en': { PRO_LEARN_EN: manuals.en },
  './manualContent.generated': { PRO_LEARN_HR: manuals.hr },
  './manualContent.sl': { PRO_LEARN_SL: manuals.sl },
});
const route = fs.readFileSync(path.join(root, 'app/pro-guide/[topicId].tsx'), 'utf8');
const allLinks = (manual) => manual.topics.flatMap((topic) => [
  ...[topic.introduction, ...topic.sections.map((section) => section.markdown)]
    .flatMap((markdown) => [...markdown.matchAll(/\]\(#([^)]+)\)/g)].map(([, anchor]) => ({ topic, anchor }))),
]);

let linkCount = 0;
const linksPerLanguage = [];
for (const [language, manual] of Object.entries(manuals)) {
  assert.equal(manual.topics.length, 18, `${language} topic count`);
  const links = allLinks(manual);
  linkCount += links.length;
  linksPerLanguage.push(links.length);
  for (const { topic, anchor } of links) {
    const decoded = decodeURIComponent(anchor);
    const destination = findProLearnAnchor(manual, decoded);
    assert.ok(destination, `${language} ${topic.id} link #${decoded} resolves`);
    assert.ok(
      destination.topic.id === decoded || destination.topic.sections.some((section) => section.id === decoded),
      `${language} ${topic.id} link #${decoded} has a topic or section target`,
    );
  }
  for (const [sourceTopic, targetAnchor] of [
    ['topic-water', 'method-biga'],
    ['topic-dough', 'topic-gluten-free'],
    ['topic-yeast', 'topic-storage'],
  ]) {
    const source = manual.topics.find((topic) => topic.id === sourceTopic);
    assert.ok(source, `${language} ${sourceTopic} exists`);
    assert.ok(
      allLinks({ topics: [source] }).some(({ anchor }) => decodeURIComponent(anchor) === targetAnchor),
      `${language} ${sourceTopic} links to #${targetAnchor}`,
    );
    const destination = findProLearnAnchor(manual, targetAnchor);
    assert.ok(destination, `${language} example target #${targetAnchor} resolves`);
    assert.ok(destination.sectionId || destination.topic.id === targetAnchor, `${language} example has exact target`);
  }
}

assert.deepEqual(linksPerLanguage, [25, 25, 25, 25], 'all localized internal links are included');
assert.equal(linkCount, 100, 'the current four localized manuals contain 100 internal links');
assert.match(route, /router\.replace\('\/pro-guide'\)/, 'Back to topics always replaces with the topic list');
assert.doesNotMatch(route, /const goBack = useCallback\(\(\) => \{\s*if \(router\.canGoBack\(\)\) router\.back\(\)/, 'topic back action does not return to previous topic');
assert.match(route, /sectionPositions\.current = \{\};\s*pendingAnchor\.current = initialSection \?\? null;/, 'topic changes discard stale section positions before resolving deep links');
assert.match(route, /requestAnimationFrame\(\(\) => scrollToAnchor\(section\.id\)\)/, 'target section scroll waits for its layout');
assert.match(route, /router\.push\(\{[\s\S]*pathname: '\/pro-guide\/\[topicId\]'[\s\S]*section: destination\.sectionId/, 'cross-topic links retain the exact section in navigation');

console.log(`F41 navigation regression passed: ${linkCount} existing links across HR/EN/DE/SL; anchors, examples, scroll readiness, and topic-list return verified.`);
