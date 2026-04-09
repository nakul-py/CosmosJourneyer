import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const rendererDir = resolve(currentDir, "..", "..", "game", "dist");
const indexPath = resolve(rendererDir, "index.html");
const timeoutMs = 120_000;
const pollIntervalMs = 250;
const startTime = Date.now();

function getLocalAssetPaths(indexHtml) {
    const assetPaths = new Set();
    const pattern = /\b(?:src|href)="([^"]+)"/gu;

    for (const match of indexHtml.matchAll(pattern)) {
        const assetPath = match[1];
        if (assetPath === undefined || assetPath.startsWith("http://") || assetPath.startsWith("https://")) {
            continue;
        }

        assetPaths.add(resolve(rendererDir, assetPath));
    }

    return [...assetPaths];
}

async function rendererBuildIsReady() {
    try {
        const indexHtml = await readFile(indexPath, "utf8");
        const assetPaths = getLocalAssetPaths(indexHtml);
        await Promise.all(assetPaths.map((assetPath) => access(assetPath)));
        return true;
    } catch {
        return false;
    }
}

while (!(await rendererBuildIsReady())) {
    if (Date.now() - startTime > timeoutMs) {
        console.error("Timed out waiting for the desktop renderer build to become ready.");
        process.exit(1);
    }

    await new Promise((resolvePromise) => {
        setTimeout(resolvePromise, pollIntervalMs);
    });
}
