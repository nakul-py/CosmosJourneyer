import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const gameDistDir = resolve(currentDir, "..", "..", "game", "dist");

await rm(gameDistDir, { force: true, recursive: true });
