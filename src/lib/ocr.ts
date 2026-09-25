import "server-only";

import { createRequire } from "node:module";
import { access, constants, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createWorker, type Worker } from "tesseract.js";
import { logInfo } from "@/lib/log";
import { readableCardText } from "@/lib/ocr-text";

const require = createRequire(path.join(process.cwd(), "package.json"));
const CACHE_PATH = path.join("/tmp", "sourcing-china-tesseract");
const LANG_PATH = path.join(CACHE_PATH, "lang");
const OCR_MS = 25_000;

/** The worker thread loads these with Node require. Resolving them here fails in our try/catch instead of crashing the function. */
function assertWorkerModules(): void {
  require.resolve("bmp-js");
  require.resolve("is-url");
  require.resolve("tesseract.js");
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ocr_timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export type CardOcr = {
  text: string | null;
  provider: "tesseract" | "tesseract_error";
};

let workerPromise: Promise<Worker> | null = null;
let queue: Promise<unknown> = Promise.resolve();

function trainedData(pkg: string, file: string): string {
  return require.resolve(`${pkg}/4.0.0/${file}`);
}

async function stageFile(pkg: string, file: string): Promise<void> {
  const dest = path.join(LANG_PATH, file);
  try {
    await access(dest, constants.R_OK);
  } catch {
    await copyFile(trainedData(pkg, file), dest);
  }
}

async function stageLanguages(): Promise<void> {
  await mkdir(LANG_PATH, { recursive: true });
  await Promise.all([
    stageFile("@tesseract.js-data/eng", "eng.traineddata.gz"),
    stageFile("@tesseract.js-data/chi_sim", "chi_sim.traineddata.gz"),
  ]);
}

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      await stageLanguages();
      const worker = await createWorker("eng+chi_sim", 1, {
        langPath: LANG_PATH,
        cachePath: CACHE_PATH,
        gzip: true,
        errorHandler: (error) => logInfo("ocr_worker_error", { error: String(error).slice(0, 180) }),
      });
      await worker.setParameters({ user_defined_dpi: "300" });
      return worker;
    })().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Stop the OCR worker so a command-line run can exit. */
export async function shutdownOcr(): Promise<void> {
  const pending = workerPromise;
  workerPromise = null;
  if (!pending) return;
  try {
    const worker = await pending;
    await worker.terminate();
  } catch {
    // The worker failed before it started.
  }
}

/** Read a card photo with Tesseract (English + simplified Chinese). Never calls Google Vision. */
export async function recognizeImage(bytes: Buffer, mime: string, timeoutMs: number | null = OCR_MS): Promise<CardOcr> {
  try {
    assertWorkerModules();
    const task = exclusive(async () => {
      const worker = await getWorker();
      const result = await worker.recognize(bytes);
      return readableCardText(result.data.text);
    });
    const text = timeoutMs == null ? await task : await withTimeout(task, timeoutMs);
    return { text, provider: "tesseract" };
  } catch (error) {
    const failed = workerPromise;
    workerPromise = null;
    if (failed) void failed.then((worker) => worker.terminate()).catch(() => undefined);
    logInfo("ocr_failed", { mime, error: error instanceof Error ? error.message.slice(0, 180) : "ocr_failed" });
    return { text: null, provider: "tesseract_error" };
  }
}
