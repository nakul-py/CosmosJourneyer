import { createReadStream, watch, type FSWatcher } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, join, relative, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import type * as ElectronModule from "electron";

const require = createRequire(import.meta.url);
const { app, BrowserWindow, protocol } = require("electron") as typeof ElectronModule;

const APP_SCHEME = "app";
const APP_HOST = "bundle";
const HeaderAcceptRanges = "accept-ranges";
const HeaderContentLength = "content-length";
const HeaderContentRange = "content-range";
const HeaderContentType = "content-type";
const HeaderCrossOriginEmbedderPolicy = "Cross-Origin-Embedder-Policy";
const HeaderCrossOriginOpenerPolicy = "Cross-Origin-Opener-Policy";
const HeaderCrossOriginResourcePolicy = "Cross-Origin-Resource-Policy";
const devReloadDebounceMs = 250;
const isDevelopment = process.env["COSMOS_DESKTOP_DEV"] === "1";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const packagedRendererDir = join(currentDir, "renderer");
const developmentRendererDir = resolve(currentDir, "..", "..", "game", "dist");
const rendererDir = isDevelopment ? developmentRendererDir : packagedRendererDir;

let developmentWatcher: FSWatcher | null = null;
let reloadTimer: NodeJS.Timeout | null = null;

protocol.registerSchemesAsPrivileged([
    {
        scheme: APP_SCHEME,
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
        },
    },
]);

function getContentType(filePath: string): string {
    switch (extname(filePath).toLowerCase()) {
        case ".babylon":
            return "application/json; charset=utf-8";
        case ".css":
            return "text/css; charset=utf-8";
        case ".env":
            return "application/octet-stream";
        case ".glb":
            return "model/gltf-binary";
        case ".gltf":
            return "model/gltf+json; charset=utf-8";
        case ".html":
            return "text/html; charset=utf-8";
        case ".ico":
            return "image/x-icon";
        case ".jpeg":
        case ".jpg":
            return "image/jpeg";
        case ".js":
        case ".mjs":
            return "text/javascript; charset=utf-8";
        case ".json":
            return "application/json; charset=utf-8";
        case ".mp3":
            return "audio/mpeg";
        case ".ogg":
            return "audio/ogg";
        case ".png":
            return "image/png";
        case ".svg":
            return "image/svg+xml";
        case ".wav":
            return "audio/wav";
        case ".wasm":
            return "application/wasm";
        case ".webp":
            return "image/webp";
        default:
            return "application/octet-stream";
    }
}

function getResponseHeaders(filePath: string): Headers {
    const headers = new Headers();
    headers.set(HeaderAcceptRanges, "bytes");
    headers.set(HeaderContentType, getContentType(filePath));
    headers.set(HeaderCrossOriginOpenerPolicy, "same-origin");
    headers.set(HeaderCrossOriginEmbedderPolicy, "require-corp");
    headers.set(HeaderCrossOriginResourcePolicy, "same-origin");
    return headers;
}

function isRendererPathInsideRoot(filePath: string, rootDir: string): boolean {
    const relativePath = relative(rootDir, filePath);
    return relativePath !== "" && !relativePath.startsWith("..");
}

function shouldServeIndexHtml(urlPath: string): boolean {
    return urlPath === "/" || extname(urlPath) === "";
}

function parseRangeHeader(rangeHeader: string, fileSize: number): { start: number; end: number } | null {
    const match = /^bytes=(\d*)-(\d*)$/u.exec(rangeHeader);
    if (match === null) {
        return null;
    }

    const startString = match[1] ?? "";
    const endString = match[2] ?? "";

    if (startString === "" && endString === "") {
        return null;
    }

    let start: number;
    let end: number;

    if (startString === "") {
        const suffixLength = Number.parseInt(endString, 10);
        if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
            return null;
        }

        start = Math.max(fileSize - suffixLength, 0);
        end = fileSize - 1;
    } else {
        start = Number.parseInt(startString, 10);
        end = endString === "" ? fileSize - 1 : Number.parseInt(endString, 10);
    }

    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || end >= fileSize) {
        return null;
    }

    return { start, end };
}

function getLocalAssetPaths(indexHtml: string): Array<string> {
    const assetPaths = new Set<string>();
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

async function rendererBuildIsReady(): Promise<boolean> {
    const indexPath = join(rendererDir, "index.html");

    try {
        const indexHtml = await readFile(indexPath, "utf8");
        const assetPaths = getLocalAssetPaths(indexHtml);
        await Promise.all(assetPaths.map((assetPath) => access(assetPath)));
        return true;
    } catch {
        return false;
    }
}

async function waitForRendererBuild(timeoutMs = 5_000): Promise<boolean> {
    const pollIntervalMs = 100;
    const startTime = Date.now();

    while (!(await rendererBuildIsReady())) {
        if (Date.now() - startTime > timeoutMs) {
            return false;
        }

        await new Promise<void>((resolvePromise) => {
            setTimeout(resolvePromise, pollIntervalMs);
        });
    }

    return true;
}

async function createFileResponse(filePath: string, request: Request): Promise<Response> {
    const fileStats = await stat(filePath);
    const rangeHeader = request.headers.get("range");
    const parsedRange = rangeHeader === null ? null : parseRangeHeader(rangeHeader, fileStats.size);
    const headers = getResponseHeaders(filePath);

    if (rangeHeader !== null && parsedRange === null) {
        headers.set(HeaderContentRange, `bytes */${fileStats.size}`);
        return new Response(null, {
            status: 416,
            headers,
        });
    }

    const start = parsedRange?.start ?? 0;
    const end = parsedRange?.end ?? fileStats.size - 1;
    const contentLength = end - start + 1;

    headers.set(HeaderContentLength, `${contentLength}`);
    if (parsedRange !== null) {
        headers.set(HeaderContentRange, `bytes ${start}-${end}/${fileStats.size}`);
    }

    if (request.method === "HEAD") {
        return new Response(null, {
            status: parsedRange === null ? 200 : 206,
            headers,
        });
    }

    const nodeStream = createReadStream(filePath, { start, end });
    return new Response(Readable.toWeb(nodeStream) as globalThis.ReadableStream<Uint8Array>, {
        status: parsedRange === null ? 200 : 206,
        headers,
    });
}

async function handleAppProtocol(request: Request): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method not allowed", { status: 405 });
    }

    const { host, pathname } = new URL(request.url);
    if (host !== APP_HOST) {
        return new Response("Not found", { status: 404 });
    }

    const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
    let filePath = resolve(rendererDir, relativePath);

    if (!isRendererPathInsideRoot(filePath, rendererDir)) {
        return new Response("Bad request", { status: 400 });
    }

    try {
        await access(filePath);
    } catch {
        if (!shouldServeIndexHtml(pathname)) {
            return new Response("Not found", { status: 404 });
        }

        filePath = join(rendererDir, "index.html");
    }

    try {
        return await createFileResponse(filePath, request);
    } catch {
        return new Response("Not found", { status: 404 });
    }
}

async function reloadWhenRendererBuildIsReady(window: ElectronModule.BrowserWindow): Promise<void> {
    const isReady = await waitForRendererBuild();
    if (!isReady || window.isDestroyed()) {
        return;
    }

    window.webContents.reload();
}

function startDevelopmentWatcher(window: ElectronModule.BrowserWindow): void {
    if (!isDevelopment) {
        return;
    }

    developmentWatcher?.close();
    developmentWatcher = watch(rendererDir, { persistent: false }, () => {
        if (window.isDestroyed()) {
            return;
        }

        if (reloadTimer !== null) {
            clearTimeout(reloadTimer);
        }

        reloadTimer = setTimeout(() => {
            void reloadWhenRendererBuildIsReady(window);
        }, devReloadDebounceMs);
    });
}

function createMainWindow(): ElectronModule.BrowserWindow {
    const window = new BrowserWindow({
        width: 1280,
        height: 720,
        autoHideMenuBar: true,
        backgroundColor: "#000000",
        fullscreen: true,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });

    void window.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`);
    startDevelopmentWatcher(window);

    return window;
}

void app.whenReady().then(() => {
    protocol.handle(APP_SCHEME, handleAppProtocol);
    createMainWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on("before-quit", () => {
    developmentWatcher?.close();
    developmentWatcher = null;
    if (reloadTimer !== null) {
        clearTimeout(reloadTimer);
        reloadTimer = null;
    }
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
