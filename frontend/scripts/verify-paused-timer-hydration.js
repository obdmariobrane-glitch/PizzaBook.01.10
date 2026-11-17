#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const sourcePath = path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx');
const source = fs.readFileSync(sourcePath, 'utf8');
const sourceFile = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let initializer;
function findPausedTimer(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'pausedStillValid') {
    initializer = node.initializer?.getText(sourceFile);
  }
  ts.forEachChild(node, findPausedTimer);
}
findPausedTimer(sourceFile);
assert.ok(initializer, 'pausedStillValid initializer must exist');

const compiled = ts.transpileModule(`globalThis.result = (${initializer});`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
function evaluate(hydrated) {
  const context = { hydrated };
  vm.runInNewContext(compiled, context);
  return context.result;
}

assert.equal(evaluate({ status: 'paused', remainingMs: undefined }), false, 'missing paused duration is treated as zero');
assert.equal(evaluate({ status: 'paused', remainingMs: 0 }), false, 'zero remaining duration is discarded');
assert.equal(evaluate({ status: 'paused', remainingMs: 1500 }), true, 'positive paused duration is restored');
assert.equal(evaluate({ status: 'running', remainingMs: 1500 }), false, 'running entries are not classified as paused');

console.log('Paused timer hydration checks passed.');