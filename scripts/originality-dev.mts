/**
 * Run the Python originality service locally with the app's .env.
 *   npm run originality
 * First time: python -m venv services/originality/.venv
 *             services/originality/.venv/Scripts/pip install -r services/originality/requirements.txt
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "services", "originality");
const venv = join(dir, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const python = existsSync(venv) ? venv : "python";
const port = new URL(process.env.ORIGINALITY_SERVICE_URL || "http://127.0.0.1:8090").port || "8090";

spawn(python, ["-m", "uvicorn", "originality.app:app", "--host", "127.0.0.1", "--port", port], { cwd: dir, stdio: "inherit", env: process.env }).on("exit", (code) =>
  process.exit(code ?? 0)
);
