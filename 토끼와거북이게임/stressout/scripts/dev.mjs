import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const processes = [
  spawn(command, ["dev:server"], { cwd: root, stdio: "inherit", shell: true }),
  spawn(command, ["dev:client"], { cwd: root, stdio: "inherit", shell: true })
];

const stop = () => {
  for (const child of processes) {
    child.kill();
  }
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

for (const child of processes) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      stop();
      process.exit(code);
    }
  });
}
