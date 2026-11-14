import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gradleCommand = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const result = spawnSync(gradleCommand, ['assembleRelease', 'bundleRelease'], {
  cwd: path.join(projectRoot, 'android'),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(`Could not start Android Gradle: ${result.error.message}`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
