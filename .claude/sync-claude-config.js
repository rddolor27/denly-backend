#!/usr/bin/env node
/*
 * Sync the workspace-root .claude configuration into the Denly repos.
 *
 *   node .claude/sync-claude-config.js            # copy + report
 *   node .claude/sync-claude-config.js --check    # report drift only, exit 1 if any
 *   node .claude/sync-claude-config.js --prune    # also remove files that exist only in a repo copy
 *
 * Copies everything under the ROOT .claude/ EXCEPT the per-repo files listed in
 * PER_PROJECT (each repo keeps its own CLAUDE.md, plan.md and
 * settings.local.json) and the root-only folders in ROOT_ONLY (templates/).
 * Repos that have not been created yet are reported and skipped — this script
 * never creates a repo folder. Files that exist only in a repo copy and are not
 * per-repo are reported (and removed with --prune) so the trees stay
 * byte-identical.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, '.claude');
const PROJECTS = ['denly-mobile', 'denly-backend', 'denly-ml'];
const PER_PROJECT = new Set(['CLAUDE.md', 'plan.md', 'settings.local.json']);
const ROOT_ONLY = ['templates/'];
const SKIP_DIRS = new Set(['node_modules']);

const args = new Set(process.argv.slice(2));
const CHECK = args.has('--check');
const PRUNE = args.has('--prune');

function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, base, out);
    else out.push(path.relative(base, abs).replace(/\\/g, '/'));
  }
  return out;
}

function same(a, b) {
  if (!fs.existsSync(a) || !fs.existsSync(b)) return false;
  return fs.readFileSync(a).equals(fs.readFileSync(b));
}

const isShared = (rel) => !PER_PROJECT.has(rel) && !ROOT_ONLY.some((p) => rel.startsWith(p));
const shared = walk(SRC).filter(isShared);
let drift = 0;
let synced = 0;

for (const project of PROJECTS) {
  const projectDir = path.join(ROOT, project);
  if (!fs.existsSync(projectDir)) {
    console.log(`${project}: not created yet - skipped`);
    continue;
  }
  synced++;
  const dst = path.join(projectDir, '.claude');
  if (!CHECK) fs.mkdirSync(dst, { recursive: true });
  const changed = [];
  for (const rel of shared) {
    const from = path.join(SRC, rel);
    const to = path.join(dst, rel);
    if (same(from, to)) continue;
    changed.push(rel);
    if (!CHECK) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
  const extras = fs.existsSync(dst)
    ? walk(dst).filter((rel) => isShared(rel) && !shared.includes(rel))
    : [];
  if (extras.length && PRUNE && !CHECK) {
    for (const rel of extras) fs.rmSync(path.join(dst, rel), { force: true });
  }
  drift += changed.length + (PRUNE ? 0 : extras.length);
  const verb = CHECK ? 'out of date' : 'updated';
  console.log(
    `${project}: ${changed.length} ${verb}` +
      (changed.length ? ` (${changed.join(', ')})` : '') +
      (extras.length ? ` | extra files not in root: ${extras.join(', ')}${PRUNE && !CHECK ? ' [pruned]' : ' (use --prune)'}` : '')
  );
  if (!CHECK && !fs.existsSync(path.join(dst, 'CLAUDE.md'))) {
    console.log(`  note: ${project}/.claude/CLAUDE.md is missing - write it from .claude/templates/${project}.CLAUDE.md`);
  }
}

if (synced === 0) {
  console.log('\nNo repos exist yet; nothing to sync. The root .claude is the only copy.');
  process.exit(0);
}
if (CHECK) {
  console.log(drift ? `\nDRIFT: ${drift} file(s) differ from the root .claude` : '\nAll .claude trees are in sync.');
  process.exit(drift ? 1 : 0);
}
console.log('\nSync complete.');
