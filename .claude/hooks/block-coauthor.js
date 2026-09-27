#!/usr/bin/env node
/*
 * PreToolUse hook (Bash | PowerShell) for the denly workspace.
 *
 * An identical copy lives in every repo's .claude/hooks/ (workspace root +
 * denly-mobile + denly-backend once they exist). Edit the root copy, then sync.
 *
 * Project rule (see .claude/rules/workspace-rules.md and the git-workflow
 * skill): commits must NEVER carry a `Co-Authored-By:` trailer or a
 * "Generated with Claude Code" line. This hook denies any `git commit` /
 * `git commit --amend` / `gh pr create` invocation whose message (inline
 * -m/-F/--message/--body or a message file) contains one, so the rule is
 * enforced deterministically rather than by memory.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const FORBIDDEN = [
  /co-authored-by\s*:/i,
  /generated with \[?claude code/i,
  /🤖 generated with/i,
];

function forbiddenIn(text) {
  return FORBIDDEN.find((re) => re.test(text || ''));
}

function messageFileArg(cmd) {
  // git commit -F <file> | --file=<file> | --file <file>
  const m = /(?:^|\s)(?:-F|--file)(?:=|\s+)["']?([^\s"']+)["']?/.exec(cmd);
  return m ? m[1] : null;
}

function main(raw) {
  let out = null;
  try {
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    const input = JSON.parse(raw || '{}');
    const cmd = String((input.tool_input || {}).command || '');
    const isCommit = /\bgit\b[^\n|;&]*\bcommit\b/.test(cmd);
    const isPr = /\bgh\b\s+pr\s+(create|edit)\b/.test(cmd);
    if (isCommit || isPr) {
      let hit = forbiddenIn(cmd);
      if (!hit) {
        const file = messageFileArg(cmd);
        if (file) {
          const abs = path.resolve(input.cwd || process.cwd(), file);
          try { hit = forbiddenIn(fs.readFileSync(abs, 'utf8')); } catch {}
        }
      }
      if (hit) {
        out = {
          permissionDecision: 'deny',
          permissionDecisionReason:
            'denly commit guard: this workspace forbids Co-Authored-By / "Generated with Claude Code" ' +
            'trailers in commits and PRs. Re-run the command without that line.',
        };
      }
    }
  } catch (err) {
    out = {
      permissionDecision: 'ask',
      permissionDecisionReason: 'denly commit guard errored (' + err.message + ') - review manually',
    };
  }
  if (out) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', ...out } }));
  }
  // No output = no opinion; the scope guard and permission rules still apply.
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => main(raw));
