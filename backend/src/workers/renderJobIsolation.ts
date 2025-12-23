import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

type ChildResult = { code: number | null; signal: NodeJS.Signals | null };

function resolveRunnerCommand(jobId: number): { command: string; args: string[] } {
  const jsRunner = path.join(__dirname, 'renderJobRunner.js');
  const tsRunner = path.join(__dirname, 'renderJobRunner.ts');
  const hasJsRunner = fs.existsSync(jsRunner);

  if (hasJsRunner) {
    return { command: process.execPath, args: [jsRunner, String(jobId)] };
  }

  return {
    command: process.execPath,
    args: ['-r', 'ts-node/register/transpile-only', tsRunner, String(jobId)],
  };
}

const DEFAULT_MAX_OLD_SPACE_MB = 256;

function buildNodeOptions(): string {
  const existing = process.env.NODE_OPTIONS?.trim();
  const cap = `--max-old-space-size=${DEFAULT_MAX_OLD_SPACE_MB}`;
  if (!existing) return cap;
  if (existing.includes('--max-old-space-size=')) return existing;
  return `${existing} ${cap}`;
}

export async function runRenderJobIsolated(jobId: number): Promise<ChildResult> {
  const { command, args } = resolveRunnerCommand(jobId);
  const nodeOptions = buildNodeOptions();

  return new Promise<ChildResult>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, NODE_OPTIONS: nodeOptions },
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve({ code, signal }));
  });
}
