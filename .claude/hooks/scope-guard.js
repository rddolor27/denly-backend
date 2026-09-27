#!/usr/bin/env node
/*
 * PreToolUse scope guard for the denly workspace.
 *
 * An identical copy of this script lives in every repo's .claude/hooks/
 * (workspace root + denly-mobile + denly-backend once they exist), wired via
 * each project's .claude/settings.json. Edit the root copy, then sync.
 *
 * Allows any tool call (file tools or shell commands) whose paths stay inside
 * the WORKSPACE root (so the two repos can read each other's API contract),
 * the Claude scratchpad temp dir, or the user's ~/.claude config/memory dir —
 * and denies calls that reference paths outside them. ".." traversal is
 * resolved against the session cwd: hops that land inside the workspace are
 * allowed, hops that escape it are denied. In-scope calls are auto-approved,
 * so Claude runs without permission prompts while being unable to wander into
 * other projects.
 *
 * It also denies ANY tool call (file tool or shell command) that references a
 * secret file — .env*, configs/.*.env, a secrets/ folder, *.pem/*.key/*.p8,
 * certificates, keystores, iOS provisioning profiles, service-account /
 * credentials JSON, SSH keys — regardless of location.
 *
 * This is a guardrail against the agent wandering, not an OS-level jail:
 * a shell process could still reach outside indirectly (e.g. a script that
 * builds paths at runtime). For hard guarantees use OS sandboxing.
 */
'use strict';

const path = require('path');
const os = require('os');

const WORKSPACE_ROOT = 'D:\\Coding_Projects\\Personal-Projects\\denly';

// Lowercase, forward-slash prefixes that tool calls may touch.
const ALLOWED_PREFIXES = [
  'd:/coding_projects/personal-projects/denly',
  'c:/users/pc/appdata/local/temp/claude',
  'c:/users/pc/.claude',
];

function toWindowsPath(p) {
  let s = String(p).trim().replace(/^["']+|["']+$/g, '');
  if (s.startsWith('~')) s = path.win32.join(os.homedir(), s.slice(1));
  s = s.replace(/\\/g, '/');
  s = s.replace(/^\/\/([A-Za-z])(?=\/|$)/, '$1:'); // //c/foo  -> c:/foo
  s = s.replace(/^\/([A-Za-z])(?=\/|$)/, '$1:');   // /c/foo   -> c:/foo (git-bash)
  return s;
}

function isInScope(p, base) {
  const abs = path.win32
    .resolve(base || WORKSPACE_ROOT, toWindowsPath(p))
    .replace(/\\/g, '/')
    .toLowerCase();
  return ALLOWED_PREFIXES.some((a) => abs === a || abs.startsWith(a + '/'));
}

// ---------------------------------------------------------------------------
// Secret files: never read, write, cat, copy or upload these — even inside the
// workspace. Complements the deny rules in settings.json (which only cover the
// Read/Write/Edit tools) by also catching shell commands.
// ---------------------------------------------------------------------------
const SECRET_PATH_PATTERNS = [
  /(^|[\\/])secrets([\\/]|$)/i,                                        // secrets/ folder
  /(^|[\\/])\.env(?!\.(example|sample|template)$)(\.[^\\/\s]+)?$/i,   // .env, .env.local, … (NOT .env.example)
  /(^|[\\/])configs[\\/]\.[a-z0-9_-]+\.env$/i,                         // configs/.local.env, .prod.env
  /\.(pem|key|p8|p12|pfx|cer|crt|der|jks|keystore|mobileprovision)$/i, // private keys, certs, keystores, iOS profiles
  /[\\/][^\\/\s]*(service[-_]?account|credentials?|secret|sa)[-_]?key[^\\/\s]*\.json$/i,
  /[\\/][^\\/\s]*(client_secret|serviceaccount)[^\\/\s]*\.json$/i,
  /(^|[\\/])id_(rsa|ed25519|ecdsa|dsa)(\.pub)?$/i,
];

function isSecretPath(p) {
  const s = toWindowsPath(p);
  return SECRET_PATH_PATTERNS.some((re) => re.test(s));
}

// Any whitespace-separated token in a shell command that looks like a path
// (contains a slash/backslash or a dot-file/extension) and matches a secret pattern.
function secretTokensInCommand(cmd) {
  const hits = new Set();
  const tokens = String(cmd).split(/[\s"'`;|&<>()]+/).filter(Boolean);
  for (let tok of tokens) {
    tok = tok.replace(/^[-=]+/, ''); // --file=./secrets/x.json -> ./secrets/x.json (best effort)
    const eq = tok.indexOf('=');
    if (eq > -1 && /[\\/]/.test(tok.slice(eq + 1))) tok = tok.slice(eq + 1);
    if (isSecretPath(tok)) hits.add(tok);
  }
  return [...hits];
}

// Token patterns that can name a filesystem location inside a shell command.
const PATH_TOKEN_PATTERNS = [
  /(?:^|[\s"'`(=,;])([A-Za-z]:[\\/][^\s"'`;,|&<>)]*)/g, // C:\foo or C:/foo
  /(?:^|[\s"'`(=,;])(\\\\[^\s"'`;,|&<>)]+)/g,           // \\server\share (UNC)
  /(?:^|[\s"'`(=,;])(\/\/[A-Za-z]\/[^\s"'`;,|&<>)]*)/g, // //c/foo
  /(?:^|[\s"'`(=,;])(\/[A-Za-z]\/[^\s"'`;,|&<>)]*)/g,   // /c/foo (git-bash)
  /(?:^|[\s"'`(=,;])(~[\\/][^\s"'`;,|&<>)]*)/g,         // ~/foo
];

// Relative tokens containing a ".." path segment (cd .., ../foo, a\..\b).
// Bounded so git ranges (main..dev), ellipses (...) and a..b never match.
const DOTDOT_TOKEN_PATTERN =
  /(?:^|[\s"'`(=,;])((?:[^\s"'`;,|&<>)]*[\\/])?\.\.(?:[\\/][^\s"'`;,|&<>)]*)?)(?=$|[\s"'`;,|&<>)])/g;

function scanCommand(cmd, cwd) {
  const offenders = new Set();

  for (const re of PATH_TOKEN_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(cmd)) !== null) {
      if (!isInScope(m[1])) offenders.add(m[1]);
    }
  }

  // ".." traversal: resolve against the session cwd — allowed while it stays
  // inside the workspace, denied when it escapes (or when cwd is unknown).
  DOTDOT_TOKEN_PATTERN.lastIndex = 0;
  let m;
  while ((m = DOTDOT_TOKEN_PATTERN.exec(cmd)) !== null) {
    const tok = m[1];
    if (!cwd) {
      offenders.add(tok + ' (".." with unknown cwd)');
    } else if (!isInScope(tok, cwd)) {
      offenders.add(tok + ' (resolves outside the workspace)');
    }
  }

  // Bare drive change: "cd d:", "Set-Location C:"
  const cdDrive = /\b(?:cd|chdir|pushd|Set-Location|Push-Location)\b[^\n;|&]*?\s['"]?([A-Za-z]):(?=$|[\s;|&"'])/i.exec(cmd);
  if (cdDrive) offenders.add(cdDrive[1] + ': (bare drive change)');

  return [...offenders];
}

function main(raw) {
  let decision;
  try {
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // strip UTF-8 BOM
    const input = JSON.parse(raw || '{}');
    const tool = input.tool_name || '';
    const ti = input.tool_input || {};
    const cwd = input.cwd ? toWindowsPath(String(input.cwd)) : '';
    let offenders = [];
    let secrets = [];

    if (tool === 'Bash' || tool === 'PowerShell') {
      offenders = scanCommand(String(ti.command || ''), cwd);
      secrets = secretTokensInCommand(String(ti.command || ''));
    } else {
      for (const key of ['file_path', 'notebook_path', 'path']) {
        if (ti[key] && !isInScope(ti[key], cwd || WORKSPACE_ROOT))
          offenders.push(String(ti[key]));
        if (ti[key] && isSecretPath(ti[key])) secrets.push(String(ti[key]));
      }
    }

    if (secrets.length > 0) {
      decision = {
        permissionDecision: 'deny',
        permissionDecisionReason:
          'denly scope guard: secret file access is forbidden (.env, secrets/, keys, certificates, provisioning profiles, service-account JSON) -> ' +
          [...new Set(secrets)].join(', ') +
          '. Reference the env var / secret name instead and ask the user for the value if needed.',
      };
    } else if (offenders.length > 0) {
      decision = {
        permissionDecision: 'deny',
        permissionDecisionReason:
          'denly scope guard: blocked reference outside the workspace -> ' +
          [...new Set(offenders)].join(', '),
      };
    } else {
      decision = {
        permissionDecision: 'allow',
        permissionDecisionReason: 'denly scope guard: within workspace scope',
      };
    }
  } catch (err) {
    decision = {
      permissionDecision: 'ask',
      permissionDecisionReason:
        'denly scope guard errored (' + err.message + ') - review manually',
    };
  }

  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', ...decision } })
  );
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => main(raw));
