import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Vercel turns every file under api/ into a serverless function unless the file
// or one of its folders starts with "_". A test file outside _lib therefore
// becomes a function (and broke the deploy on 23.10.2026); the Hobby plan also
// allows at most 12 functions.
const API_DIR = join(import.meta.dirname, '..');
const MAX_FUNCTIONS = 12;

function deployedFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('_')) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return deployedFiles(path);
    return /\.(ts|js)$/.test(name) ? [relative(API_DIR, path)] : [];
  });
}

describe('api/ function layout', () => {
  const files = deployedFiles(API_DIR);

  it('keeps test files out of deployed function paths', () => {
    expect(files.filter((f) => /\.test\.(ts|js)$/.test(f))).toEqual([]);
  });

  it(`stays within ${MAX_FUNCTIONS} serverless functions`, () => {
    expect(files.length).toBeLessThanOrEqual(MAX_FUNCTIONS);
  });
});
