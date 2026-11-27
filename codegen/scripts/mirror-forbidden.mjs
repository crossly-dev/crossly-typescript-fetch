/**
 * Things that must never reach a public repo, and the scan that enforces it.
 * Shared by sync-public-mirrors.mjs, tools/ci/publish-sdk-specs.mjs and (as a
 * copy, via the publish) the crossly-sdk-gen workflow's mirror push.
 *
 * Deliberately broad — a false positive costs one look, a miss is permanent,
 * because GitHub forks and caches outlive a delete. Mutation-tested: it does
 * fire. Keep test fixtures under 12 chars after a `crossly_*_` prefix.
 *
 * This file is published (crossly-sdk-gen), so it holds only generic token
 * shapes. Infrastructure specifics are added by the private callers.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const FORBIDDEN = [
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'AWS access key id', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub token', re: /gh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: 'Slack token', re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'Stripe live key', re: /sk_live_[A-Za-z0-9]{10,}/ },
  { name: 'Crossly token', re: /crossly_(pat|oat)_[A-Za-z0-9]{12,}/ },
  { name: 'credentialed postgres URL', re: /postgres(ql)?:\/\/[^\s"']+:[^\s"']+@/ },
  { name: 'credentialed redis URL', re: /redis:\/\/[^\s"']*:[^\s"']+@/ },
];

/**
 * Scan `files` (paths relative to `dir`). Reads every file rather than
 * sampling: this is the whole security gate. Returns [{ file, name, sample }].
 */
export function auditFiles(dir, files, patterns = FORBIDDEN) {
  const hits = [];
  for (const rel of files) {
    const abs = join(dir, rel);
    if (!existsSync(abs)) continue;
    let body;
    try {
      body = readFileSync(abs, 'utf8');
    } catch {
      continue; // binary or unreadable
    }
    for (const { name, re } of patterns) {
      const m = body.match(re);
      if (m) hits.push({ file: rel, name, sample: m[0].slice(0, 40) });
    }
  }
  return hits;
}
