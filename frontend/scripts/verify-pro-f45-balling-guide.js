#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const frontendRoot = path.join(__dirname, '..');
const componentPath = path.join(frontendRoot, 'src', 'components', 'MixingGuideCarousel.tsx');
const screenPath = path.join(frontendRoot, 'app', '(tabs)', 'index.tsx');
const componentSource = fs.readFileSync(componentPath, 'utf8');
const screenSource = fs.readFileSync(screenPath, 'utf8');
const ballingImagesBlock = componentSource.match(/const BALLING_IMAGES = \[([\s\S]*?)\];/);

assert.ok(ballingImagesBlock, 'the PRO balling guide has an image list');
const imagePaths = [...ballingImagesBlock[1].matchAll(/require\('([^']+)'\)/g)].map((match) => match[1]);
assert.equal(imagePaths.length, 5, 'the balling guide contains five ordered pages');

for (const [index, imagePath] of imagePaths.entries()) {
  const assetPath = path.resolve(path.dirname(componentPath), imagePath);
  assert.ok(fs.existsSync(assetPath), `balling guide page ${index + 1} asset exists: ${imagePath}`);
  const signature = fs.readFileSync(assetPath).subarray(0, 8);
  assert.deepEqual(signature, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), `page ${index + 1} is a valid PNG`);
}

assert.match(componentSource, /kind === 'balling'\s*\n\s*\?\s*BALLING_IMAGES/);
assert.match(componentSource, /{images\.map\(\(source, index\) => \([\s\S]*?<Image source={source} resizeMode="contain" style={styles\.image} \/>/);
assert.match(componentSource, /accessibilityValue={{ min: 1, max: images\.length, now: activeSlide \+ 1 }}/);
assert.match(screenSource, /!isWorkflowGlutenFree && !isRomanTeglia && index === 2[\s\S]*?kind: 'balling'/);

console.log('F45 PRO balling guide five-page image regression passed.');
