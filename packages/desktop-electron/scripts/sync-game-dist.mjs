import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const packageDir = join(currentDir, "..");
const gameDistDir = join(packageDir, "..", "game", "dist");
const rendererDir = join(packageDir, "dist", "renderer");

await rm(rendererDir, { recursive: true, force: true });
await mkdir(join(packageDir, "dist"), { recursive: true });
await cp(gameDistDir, rendererDir, { recursive: true });
