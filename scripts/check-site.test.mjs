import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';

const script = join(dirname(fileURLToPath(import.meta.url)), 'check-site.mjs');

const card = (src) => `<article class="card"><img src="${src}" alt="shot"></article>`;
const page = (src) => `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>T</title></head>
<body>${card(src)}${card(src)}${card(src)}</body></html>`;

// Builds a throwaway git repo with the given files tracked, then runs the check against it.
function runCheck(files, { privateTerms } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'site-check-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  if (privateTerms) writeFileSync(join(root, '.private-terms'), privateTerms);
  return spawnSync('node', [script, root], { encoding: 'utf8' });
}

test('a clean site passes', () => {
  const r = runCheck({ 'index.html': page('assets/a.png'), 'assets/a.png': 'x' });
  assert.equal(r.status, 0, r.stderr);
});

test('an image referenced with the wrong case fails', () => {
  const r = runCheck({ 'index.html': page('assets/A.png'), 'assets/a.png': 'x' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /assets\/A\.png/);
});

test('a private term in any tracked text file fails', () => {
  const r = runCheck(
    { 'index.html': page('assets/a.png'), 'assets/a.png': 'x', 'docs/notes.md': 'see secret_project folder' },
    { privateTerms: 'secret_project\n' },
  );
  assert.equal(r.status, 1);
  assert.match(r.stderr, /docs\/notes\.md/);
});

test('a home-directory path in a tracked file fails', () => {
  const r = runCheck({ 'index.html': page('assets/a.png'), 'assets/a.png': 'x', 'notes.md': 'at /Users/someone/Desktop' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /notes\.md/);
});
