#!/usr/bin/env node
/*
 * PostToolUse hook (Edit | Write | NotebookEdit) for the denly workspace.
 *
 * An identical copy lives in every repo's .claude/hooks/ (workspace root +
 * denly-mobile + denly-backend once they exist). Edit the root copy, then sync.
 *
 * Type-check: when a .ts/.tsx file inside the workspace is edited, walks up
 * from the file to the nearest directory that has BOTH a tsconfig.json and an
 * installed node_modules/.bin/tsc (stopping at the workspace root), runs
 * `tsc --noEmit` there and, if it reports errors, exits with code 2 so the
 * errors are fed straight back to Claude. Debounced per project directory
 * (DEBOUNCE_MS) so rapid successive edits don't re-run a long compile every
 * time.
 *
 * The lookup is generic on purpose: no repo exists yet, and the hook must stay
 * correct whichever folder names the repos end up with. Before a TypeScript
 * project exists it is silent.
 *
 * Never blocks the edit itself (the tool has already run) — it only surfaces
 * information.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const WORKSPACE_ROOT = 'D:\\Coding_Projects\\Personal-Projects\\denly';
const DEBOUNCE_MS = 45 * 1000;
const TSC_TIMEOUT_MS = 120 * 1000;
const MAX_ERROR_LINES = 40;

function norm(p) {
  return String(p).replace(/\\/g, '/').replace(/^\/([A-Za-z])(?=\/)/, '$1:').toLowerCase();
}

function insideWorkspace(filePath) {
  const f = norm(filePath);
  const root = norm(WORKSPACE_ROOT);
  return f === root || f.startsWith(root + '/');
}

// Nearest ancestor of the edited file (not above the workspace root) that
// holds tsconfig.json + an installed tsc. Skips node_modules and the root
// itself (the root is not a project).
function findTsProject(filePath) {
  const root = path.win32.resolve(WORKSPACE_ROOT);
  let dir = path.win32.dirname(path.win32.resolve(filePath));
  while (norm(dir) !== norm(root) && norm(dir).startsWith(norm(root) + '/')) {
    if (!/[\\/]node_modules([\\/]|$)/i.test(dir)) {
      const tsconfig = path.join(dir, 'tsconfig.json');
      const tsc = path.join(dir, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
      if (fs.existsSync(tsconfig)) {
        return { dir, tsc: fs.existsSync(tsc) ? tsc : null, name: path.basename(dir) };
      }
    }
    const parent = path.win32.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function stampPath(projectDir) {
  const key = norm(projectDir).replace(/[^a-z0-9]+/g, '-');
  return path.join(os.tmpdir(), `denly-tsc-${key}.stamp`);
}

function recentlyChecked(projectDir) {
  try {
    const t = Number(fs.readFileSync(stampPath(projectDir), 'utf8'));
    return Date.now() - t < DEBOUNCE_MS;
  } catch {
    return false;
  }
}

function touchStamp(projectDir) {
  try { fs.writeFileSync(stampPath(projectDir), String(Date.now())); } catch {}
}

function runTsc(project) {
  if (!project.tsc) return { skipped: `tsc not installed in ${project.name} (install dependencies first)` };
  const r = spawnSync(`"${project.tsc}" --noEmit --pretty false`, {
    cwd: project.dir,
    encoding: 'utf8',
    shell: true,
    timeout: TSC_TIMEOUT_MS,
    windowsHide: true,
  });
  if (r.error) return { skipped: `tsc could not run: ${r.error.message}` };
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  const errors = out.split(/\r?\n/).filter((l) => /error TS\d+/.test(l));
  return { status: r.status, errors, raw: out };
}

function main(raw) {
  let input = {};
  try {
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    input = JSON.parse(raw || '{}');
  } catch {
    return; // nothing to do
  }
  const ti = input.tool_input || {};
  const filePath = ti.file_path || ti.notebook_path || '';
  if (!filePath || !insideWorkspace(filePath)) return;

  const isTs = /\.(ts|tsx|mts|cts)$/i.test(filePath);
  if (!isTs) return;

  const project = findTsProject(filePath);
  if (!project) return; // no TypeScript project around this file yet — stay silent

  const notes = [];
  if (!recentlyChecked(project.dir)) {
    touchStamp(project.dir);
    const res = runTsc(project);
    if (res.skipped) {
      notes.push(`[tsc] skipped: ${res.skipped}`);
    } else if (res.errors.length > 0) {
      const shown = res.errors.slice(0, MAX_ERROR_LINES).join('\n');
      const more = res.errors.length > MAX_ERROR_LINES ? `\n... and ${res.errors.length - MAX_ERROR_LINES} more` : '';
      process.stderr.write(
        `[denly tsc] ${res.errors.length} type error(s) in ${project.name} after editing ${path.basename(filePath)}. ` +
          `Fix these before continuing:\n${shown}${more}\n`
      );
      process.exit(2);
    } else {
      notes.push(`[tsc] ${project.name}: no type errors.`);
    }
  } else {
    notes.push(`[tsc] ${project.name}: checked <45s ago, skipped (re-run \`npx tsc --noEmit\` yourself before finishing).`);
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: notes.join('\n') },
    })
  );
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => main(raw));
