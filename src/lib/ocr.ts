import "server-only";

import { createRequire } from "node:module";
import { access, constants, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createWorker, type Worker } from "tesseract.js";
import { decodePrimaryJpeg, downscaleMax, encodeJpeg, rotateQuarter } from "@/lib/cards/jpeg-frame";
import { MIN_CARD_SIDE, jpegSize, tinyPhotoMessage } from "@/lib/cards/image";
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

const PREVIEW_EDGE = 900;
const ROTATE_MARGIN = 8;

export type OpenedJpeg = {
  bytes: Buffer;
  width: number;
  height: number;
  decodedWidth: number;
  decodedHeight: number;
  /** Counter-clockwise quarter turns applied so the text is horizontal. */
  turns: number;
};

function orientationScore(text: string, confidence: number): number {
  const letters = text.match(/[A-Za-z0-9\u4e00-\u9fff]/g)?.length ?? 0;
  return confidence + Math.min(50, letters / 2);
}

async function withWorker<T>(task: (worker: Worker) => Promise<T>): Promise<T> {
  return exclusive(async () => {
    const worker = await getWorker();
    return task(worker);
  });
}

/**
 * Decode the primary JPEG frame, turn it so the writing is horizontal, and
 * re-encode a single photo. Tesseract otherwise reads the tiny preview stored
 * in some phone JPEGs (a 2×36 strip).
 */
export async function openJpegForOcr(bytes: Buffer): Promise<OpenedJpeg> {
  const decoded = decodePrimaryJpeg(bytes);
  const preview = downscaleMax(decoded, PREVIEW_EDGE);
  const scores: number[] = [];
  for (let turns = 0; turns < 4; turns += 1) {
    const sample = encodeJpeg(rotateQuarter(preview, turns), 75);
    const score = await withWorker(async (worker) => {
      const result = await worker.recognize(sample);
      return orientationScore(result.data.text ?? "", Number(result.data.confidence) || 0);
    });
    scores.push(score);
    if (turns === 0 && score >= 110) break;
  }
  let best = 0;
  for (let turns = 1; turns < scores.length; turns += 1) {
    if ((scores[turns] ?? 0) > (scores[best] ?? 0) + ROTATE_MARGIN) best = turns;
  }
  const upright = rotateQuarter(decoded, best);
  const encoded = encodeJpeg(upright, 82);
  const size = jpegSize(encoded);
  if (!size || size.width < MIN_CARD_SIDE || size.height < MIN_CARD_SIDE) {
    throw new Error(tinyPhotoMessage("JPEG", size));
  }
  return {
    bytes: encoded,
    width: size.width,
    height: size.height,
    decodedWidth: decoded.width,
    decodedHeight: decoded.height,
    turns: best,
  };
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
export async function recognizeImage(
  bytes: Buffer,
  mime: string,
  timeoutMs: number | null = OCR_MS,
  options?: { prepared?: boolean },
): Promise<CardOcr> {
  try {
    assertWorkerModules();
    const task = (async () => {
      let photo = bytes;
      if (!options?.prepared && (mime === "image/jpeg" || mime === "image/jpg")) {
        photo = (await openJpegForOcr(bytes)).bytes;
      }
      return withWorker(async (worker) => {
        const result = await worker.recognize(photo);
        return readableCardText(result.data.text);
      });
    })();
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
