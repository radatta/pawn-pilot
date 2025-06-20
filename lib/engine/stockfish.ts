// Simple Stockfish (WASM) wrapper for the browser
// This is executed client-side only.

let stockfishWorker: Worker | null = null;

// Indicates the engine has answered `uci` or `isready` with the corresponding
// *ok message and is therefore ready to accept a new command.
let ready = false;

// Resolvers waiting for a `readyok` (or `uciok`) response.
const readyResolvers: Array<() => void> = [];

// Resolvers waiting for a `bestmove` response.
const pendingMoveResolvers: Array<(best: string) => void> = [];

async function initEngine() {
    if (stockfishWorker) return;

    if (!wasmThreadsSupported()) {
        throw new Error("WASM not supported");
    }

    stockfishWorker = new window.Worker("/lib/stockfish-16.1.js#/lib/stockfish-16.1.wasm");

    stockfishWorker.onmessage = (e: MessageEvent<string>) => {
        const line: string = e.data;

        if (line === "uciok" || line === "readyok") {
            ready = true;
            // flush all promises waiting for readiness
            while (readyResolvers.length) readyResolvers.shift()?.();
            return;
        }

        if (line.startsWith("bestmove")) {
            const move = line.split(" ")[1];
            const resolve = pendingMoveResolvers.shift();
            resolve?.(move);
            return;
        }
    };

    // Start the UCI handshake
    ready = false;
    stockfishWorker.postMessage("uci");
    await waitUntilReady();
}

function waitUntilReady(): Promise<void> {
    if (ready) return Promise.resolve();
    return new Promise((res) => readyResolvers.push(res));
}

export async function getBestMove(fen: string): Promise<string> {
    if (typeof window === "undefined") throw new Error("Engine can run only in browser");

    await initEngine();

    // Prepare position and wait for the engine to acknowledge with `readyok`.
    ready = false;
    stockfishWorker!.postMessage("ucinewgame");
    stockfishWorker!.postMessage(`position fen ${fen}`);
    stockfishWorker!.postMessage("isready");
    await waitUntilReady();

    return new Promise((resolve, reject) => {
        if (!stockfishWorker) return reject("Engine not initialised");

        const timeout = setTimeout(() => {
            reject(new Error("Engine timeout"));
        }, 8000);

        pendingMoveResolvers.push((best) => {
            clearTimeout(timeout);
            resolve(best);
        });

        // Launch search – depth may be tweaked by caller later.
        stockfishWorker.postMessage("go depth 12");
    });
}

// Allow React components to clean up when they unmount
export function terminateEngine() {
    stockfishWorker?.terminate();
    stockfishWorker = null;
    ready = false;
    readyResolvers.length = 0;
    pendingMoveResolvers.length = 0;
}

// Renamed to conform to TS/JS naming conventions (fix #9)
export type StockfishState = "Loading" | "Ready" | "Waiting" | "Failed";

export function wasmThreadsSupported() {
    // WebAssembly 1.0
    const source = Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00);
    if (
        typeof WebAssembly !== "object" ||
        typeof WebAssembly.validate !== "function"
    )
        return false;
    if (!WebAssembly.validate(source)) return false;

    // SharedArrayBuffer
    if (typeof SharedArrayBuffer !== "function") return false;

    // Atomics
    if (typeof Atomics !== "object") return false;

    // Shared memory
    const mem = new WebAssembly.Memory({ shared: true, initial: 8, maximum: 16 });
    if (!(mem.buffer instanceof SharedArrayBuffer)) return false;

    // Structured cloning
    try {
        window.postMessage(mem, "*");
    } catch (e) {
        console.log(`Browser Error ${e}`);
        return false;
    }

    // Growable shared memory (optional)
    try {
        mem.grow(8);
    } catch (e) {
        console.log(`Browser Error ${e}`);
        return false;
    }

    return true;
}