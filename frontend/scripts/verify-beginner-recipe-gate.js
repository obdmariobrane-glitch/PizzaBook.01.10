#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'), 'utf8');

assert.match(
  source,
  /\{\(!isBeginner \|\| beginnerDirectHome\) \? \(\s*<View style=\{styles\.card\}>/,
  'Beginner recipe steps must render only for scheduled Beginner Direct recipes',
);
assert.match(
  source,
  /const beginnerDirectHome = isBeginner && method === 'direct' && !!directHomeSchedule/,
  'The recipe gate must use the existing scheduled Beginner state',
);
assert.match(
  source,
  /const beginnerUnscheduledDirectSteps = beginnerDirectRecipeSteps && !directHomeSchedule/,
  'Unscheduled Beginner recipe generation must remain available',
);
assert.match(
  source,
  /\(beginnerDirectHomeSteps \?\? beginnerUnscheduledDirectSteps \?\? beginnerDirectRecipeSteps \?\? detailedDirectSteps\)\.map/,
  'The existing scheduled and unscheduled recipe step sources must remain unchanged',
);
assert.match(source, /const beginnerHomeRecipeLayout = isBeginner && !!\(/);
assert.match(source, /method === 'direct' && directHomeSchedule/);
assert.match(source, /pizzaStyle === 'ny_style'/);
assert.match(source, /romanFormat === 'tonda'/);
assert.match(source, /isRomanTeglia/);
assert.match(source, /flour === 'glutenFree'/);
assert.match(source, /isCustom/);
assert.match(source, /mixing === 'mixer'/);
assert.match(source, /testID="beginner-choose-bake-time"/);

console.log('Beginner recipe gate checks passed.');
