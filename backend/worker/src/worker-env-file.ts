import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function loadWorkerEnvFiles(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): string[] {
  const rootDir = path.resolve(cwd, "..", "..");
  const paths = [
    path.join(rootDir, ".env"),
    path.join(rootDir, ".env.local"),
    path.join(cwd, ".env"),
    path.join(cwd, ".env.local")
  ];
  const loaded: string[] = [];

  for (const filePath of paths) {
    if (!existsSync(filePath)) {
      continue;
    }
    loadEnvFile(filePath, env);
    loaded.push(filePath);
  }

  return loaded;
}

function loadEnvFile(filePath: string, env: NodeJS.ProcessEnv): void {
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [rawName, ...rawValueParts] = trimmed.split("=");
    const name = rawName.trim();
    if (!name || env[name] !== undefined) {
      continue;
    }

    env[name] = unquote(rawValueParts.join("=").trim());
  }
}

function unquote(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
