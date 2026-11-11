import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

/**
 * Cross-platform process spawn helper supporting Windows Node 20+
 * Handles CVE-2024-27980 EINVAL, .cmd resolution, and process tree termination on timeout.
 * Combines stdout and stderr streams so checks don't miss diagnostic output.
 *
 * @param {string} command - Path to executable or script
 * @param {string[]} [args=[]] - Command line arguments
 * @param {object} [options={}] - Execution options
 * @param {string} [options.cwd=process.cwd()] - Working directory
 * @param {object} [options.env={}] - Additional environment variables
 * @param {number} [options.timeout=60000] - Timeout in milliseconds
 * @param {boolean} [options.shell=false] - Whether to use a shell
 * @param {boolean} [options.useNode=false] - Whether to execute with process.execPath
 * @returns {Promise<{
 *   status: number | null,
 *   signal: string | null,
 *   stdout: string,
 *   stderr: string,
 *   combinedOutput: string,
 *   durationMs: number,
 *   timedOut: boolean,
 *   error?: Error
 * }>}
 */
export function execCommand(command, args = [], options = {}) {
  const {
    cwd = process.cwd(),
    env = {},
    timeout = 60000,
    shell = false,
    useNode = false,
  } = options;

  return new Promise((resolve) => {
    const mergedEnv = {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@localhost:5432/flashcard?schema=public',
      DIRECT_URL:
        process.env.DIRECT_URL ||
        'postgresql://postgres:postgres@localhost:5432/flashcard?schema=public',
      NEXTAUTH_SECRET:
        process.env.NEXTAUTH_SECRET ||
        'flashcard-test-secret-at-least-32-chars-long-1234',
      ...env,
    };

    let executable = command;
    let finalArgs = [...args];
    let effectiveShell = shell;

    if (useNode) {
      executable = process.execPath;
      finalArgs = [command, ...args];
      effectiveShell = false;
    } else if (process.platform === 'win32' && !shell) {
      if (command === 'npm' || command === 'npx') {
        effectiveShell = true;
      }
    }

    const startTime = Date.now();
    let timedOut = false;
    let child;

    try {
      child = spawn(executable, finalArgs, {
        cwd,
        env: mergedEnv,
        shell: effectiveShell,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      return resolve({
        status: 1,
        signal: null,
        stdout: '',
        stderr: err.message,
        combinedOutput: err.message,
        durationMs: Date.now() - startTime,
        timedOut: false,
        error: err,
      });
    }

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === 'win32' && child.pid) {
        try {
          spawnSync('taskkill', ['/pid', String(child.pid), '/f', '/t'], {
            stdio: 'ignore',
          });
        } catch {
          try {
            child.kill('SIGKILL');
          } catch {
            // Ignore kill errors
          }
        }
      } else {
        try {
          child.kill('SIGKILL');
        } catch {
          // Ignore kill errors
        }
      }
    }, timeout);

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const combinedOutput = (stdout || '') + (stderr ? (stdout ? '\n' : '') + stderr : '');
      resolve({
        status: code ?? (signal ? 1 : 0),
        signal,
        stdout,
        stderr,
        combinedOutput,
        durationMs: Date.now() - startTime,
        timedOut,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      const combinedOutput = (stdout || '') + (stderr ? '\n' + stderr : '') + (err ? '\n' + err.message : '');
      resolve({
        status: 1,
        signal: null,
        stdout,
        stderr: (stderr ? stderr + '\n' : '') + err.message,
        combinedOutput,
        durationMs: Date.now() - startTime,
        timedOut,
        error: err,
      });
    });
  });
}
