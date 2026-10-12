import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Usage: node scripts/check-site.mjs [siteRoot]
const root = process.argv[2] ? resolve(process.argv[2]) : join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const fail = (message) => failures.push(message);

const read = (file) => (existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : '');

const html = read('index.html');

if (!html) {
  console.error('FAIL: index.html is missing');
  process.exit(1);
}

// Files git will publish. Exact, case-sensitive paths, unlike the macOS filesystem.
const tracked = new Set(
  execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean),
);

// 1. Every local href/src must be a tracked file, spelled exactly.
for (const [, ref] of html.matchAll(/(?:href|src)="([^"#:?]+)"/g)) {
  if (!tracked.has(ref)) fail(`local reference not tracked by git (missing, wrong case, or uncommitted): ${ref}`);
}

// 2. Every <img> needs non-empty alt text.
for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
  if (!/\balt="[^"]+"/.test(tag)) fail(`img without alt text: ${tag}`);
}

// 3. External links must use rel="noopener".
for (const [tag] of html.matchAll(/<a\b[^>]*href="https?:[^>]*>/g)) {
  if (!/rel="[^"]*noopener/.test(tag)) fail(`external link without rel=noopener: ${tag}`);
}

// 4. Privacy scan over every tracked text file. Extra terms (names that must not be
//    published) live in the git-ignored .private-terms file, one per line.
const forbidden = [
  [/\b\d{1,3}(\.\d{1,3}){3}\b/, 'IPv4 address'],
  [/clients\.json/i, 'clients.json'],
  [/\.pem\b/i, '.pem path'],
  [/mongodb(\+srv)?:\/\//i, 'mongodb connection string'],
  [/\/Users\/[^/\s]+/, 'home-directory path'],
];
for (const term of read('.private-terms').split('\n').map((t) => t.trim()).filter(Boolean)) {
  forbidden.push([new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), 'private term']);
}
const TEXT = new Set(['.html', '.css', '.js', '.mjs', '.md', '.txt', '.json', '.yml', '.yaml', '.svg']);
for (const file of tracked) {
  if (file.startsWith('scripts/') || !TEXT.has(extname(file))) continue;
  const text = read(file);
  for (const [pattern, label] of forbidden) {
    if (pattern.test(text)) fail(`forbidden content (${label}) in ${file}`);
  }
}

// 4b. Exactly three project cards.
const cardCount = (html.match(/<article class="card"/g) || []).length;
if (cardCount !== 3) fail(`expected 3 project cards, found ${cardCount}`);

// 5. Basic page hygiene.
if (!/<title>[^<]+<\/title>/.test(html)) fail('missing <title>');
if (!/<meta name="viewport"/.test(html)) fail('missing viewport meta');

if (failures.length) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}
console.log('OK: all site checks passed');
