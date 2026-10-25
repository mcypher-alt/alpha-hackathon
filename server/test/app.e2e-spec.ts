import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

describe('Running submission API (start Docker Compose first)', () => {
  it('preserves the credit path, roles, ownership and concurrent transitions', () => {
    const script = fileURLToPath(
      new URL('../../scripts/smoke.mjs', import.meta.url),
    );
    const output = execFileSync(process.execPath, [script], {
      encoding: 'utf8',
      env: process.env,
      timeout: 60_000,
    });
    expect(JSON.parse(output).result).toBe('PASS');
  }, 75_000);
});
