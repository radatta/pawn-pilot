// Simple Stockfish (WASM) wrapper for the browser
// This is executed client-side only.

let stockfishWorker: Worker | null = null;
let ready = false;
const pendingResolvers: Array<(best: string) => void> = [];

async function initEngine() {
    if (stockfishWorker) return;

    if (!wasmThreadsSupported()) {
        throw new Error("WASM not supported");
    }

    stockfishWorker = new window.Worker("/lib/stockfish-16.1.js#/lib/stockfish-16.1.wasm");

    stockfishWorker!.onmessage = (e: MessageEvent<string>) => {
        const line = e.data;
        if (line === "uciok") ready = true;
        if (line.startsWith("bestmove")) {
            const move = line.split(" ")[1];
            const resolve = pendingResolvers.shift();
            resolve?.(move);
        }
    };
    stockfishWorker!.postMessage("uci");
}

export async function getBestMove(fen: string): Promise<string> {
    if (typeof window === "undefined") throw new Error("Engine can run only in browser");
    if (!stockfishWorker) await initEngine();
    if (!ready) await new Promise((r) => setTimeout(r, 100));

    return new Promise((resolve, reject) => {
        if (!stockfishWorker) return reject("Engine not initialised");

        pendingResolvers.push(resolve);
        stockfishWorker.postMessage("ucinewgame");
        stockfishWorker.postMessage(`position fen ${fen}`);
        stockfishWorker.postMessage("go depth 12");
    });
}

export type stockfishState = "Loading" | "Ready" | "Waiting" | "Failed";

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