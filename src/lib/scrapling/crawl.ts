import { spawn } from "node:child_process";
import path from "node:path";

export type ScraplingPage = { url: string; status: number; html: string };

const PYTHON = path.join(process.cwd(), ".venv", "bin", "python");
const SCRIPT = path.join(process.cwd(), "scripts", "scrapling_crawl.py");

export function scraplingCrawl(input: {
  start: string;
  maxPages: number;
  maxDepth: number;
  timeoutSec: number;
  budgetMs: number;
}): Promise<ScraplingPage[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, [SCRIPT], { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("scrapling_timeout"));
    }, input.budgetMs);
    child.stdout.on("data", (chunk) => out.push(chunk));
    child.stderr.on("data", (chunk) => err.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const text = Buffer.concat(out).toString("utf8").trim();
      if (!text) {
        reject(new Error(Buffer.concat(err).toString("utf8").slice(0, 180) || `scrapling_exit_${code}`));
        return;
      }
      try {
        const parsed = JSON.parse(text) as { pages?: ScraplingPage[]; error?: string | null };
        if (parsed.error) reject(new Error(parsed.error));
        else resolve(parsed.pages ?? []);
      } catch {
        reject(new Error("scrapling_bad_json"));
      }
    });
    child.stdin.end(
      JSON.stringify({
        start: input.start,
        max_pages: input.maxPages,
        max_depth: input.maxDepth,
        timeout: input.timeoutSec,
      }),
    );
  });
}
