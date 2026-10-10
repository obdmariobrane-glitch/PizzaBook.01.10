#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const componentPath = path.join(__dirname, '..', 'src', 'components', 'MixingGuideCarousel.tsx');
const screenPath = path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx');
const componentSource = fs.readFileSync(componentPath, 'utf8');
const screenSource = fs.readFileSync(screenPath, 'utf8');

assert.match(componentSource, /onSlideChange\?: \(slide: number\) => void/);
assert.match(componentSource, /onSlideChange\?\.\(nextSlide\)/);
assert.match(
  screenSource,
  /mixingGuideKind === 'hand' \|\| mixingGuideKind === 'mixer'[\s\S]{0,300}onSlideChange=\{setVisualGuideSlide\}/,
);

console.log('Gallery slide synchronization wiring passed.');
