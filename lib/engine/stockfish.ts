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

// Resolvers waiting for analysis info callbacks.
const infoCallbacks: Array<(info: ParsedInfo) => void> = [];

// Track the current strength set in the engine.
let strength = false;

const OPENING_PV = 1;
const MIDGAME_PV = 2;
const ENDGAME_PV = 1;

interface ParsedInfo {
    depth?: number;
    score?: { unit: "cp" | "mate"; value: number };
    multipv?: number;
    pv?: string;
}

async function setStrength(weak: boolean) {
    // No need to send commands if the state is already what we want.
    if (strength === weak) return;

    // Engine must be initialized before setting options
    if (!stockfishWorker) throw new Error("Engine not initialized");

    if (weak) {
        // Set to a limited ELO for gameplay
        ready = false;
        stockfishWorker!.postMessage("setoption name UCI_LimitStrength value true");
        // stockfishWorker!.postMessage("setoption name UCI_Elo value 600");
        stockfishWorker!.postMessage("setoption name MultiPV value 3");
        stockfishWorker!.postMessage("setoption name Skill Level value 0");
        stockfishWorker!.postMessage("isready");
        await waitUntilReady();
    } else {
        // Set to full strength for analysis
        ready = false;
        stockfishWorker!.postMessage("setoption name UCI_LimitStrength value false");
        stockfishWorker!.postMessage("setoption name MultiPV value 1");
        stockfishWorker!.postMessage("isready");
        await waitUntilReady();
    }
    strength = weak;
}

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

        // Dispatch info lines to registered callbacks for analysis use-cases
        if (line.startsWith("info")) {
            const parsed: ParsedInfo = {};
            const tokens = line.split(" ");
            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                if (token === "depth") {
                    parsed.depth = parseInt(tokens[i + 1]);
                    i++;
                } else if (token === "score") {
                    const unit = tokens[i + 1] as "cp" | "mate";
                    const value = parseInt(tokens[i + 2]);
                    parsed.score = { unit, value };
                    i += 2;
                } else if (token === "multipv") {
                    parsed.multipv = parseInt(tokens[i + 1]);
                    i++;
                } else if (token === "pv") {
                    parsed.pv = tokens.slice(i + 1).join(" ");
                    break; // rest of line is PV
                }
            }
            infoCallbacks.forEach((cb) => cb(parsed));
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

function getPv(moveNumber: number) {
    if (moveNumber <= 10) return OPENING_PV;
    if (moveNumber <= 20) return MIDGAME_PV;
    if (moveNumber <= 30) return ENDGAME_PV;
    return ENDGAME_PV;
}

export async function getBestMove(fen: string, moveNumber: number): Promise<string> {
    if (typeof window === "undefined") throw new Error("Engine can run only in browser");

    await initEngine();
    // Set engine to a weaker playing strength.
    // This will only send commands if the strength is not already set to this ELO.
    await setStrength(true);

    // Prepare position and wait for the engine to acknowledge with `readyok`.
    ready = false;
    stockfishWorker!.postMessage("ucinewgame");
    stockfishWorker!.postMessage(`position fen ${fen}`);
    stockfishWorker!.postMessage("isready");
    await waitUntilReady();

    return new Promise((resolve, reject) => {
        if (!stockfishWorker) return reject("Engine not initialised");

        let move: string | undefined;

        // Capture PV lines and extract the first move of multipv #10
        const handleInfo = (info: ParsedInfo) => {
            if (info.multipv === getPv(moveNumber) && info.pv) {
                // First token of the PV string is the move in UCI
                move = info.pv.split(" ")[0];
            }
        };
        infoCallbacks.push(handleInfo);

        const timeout = setTimeout(() => {
            // Clean up
            const idx = infoCallbacks.indexOf(handleInfo);
            if (idx !== -1) infoCallbacks.splice(idx, 1);
            reject(new Error("Engine timeout"));
        }, 8000);

        pendingMoveResolvers.push((best) => {
            clearTimeout(timeout);
            // Remove info callback
            const idx = infoCallbacks.indexOf(handleInfo);
            if (idx !== -1) infoCallbacks.splice(idx, 1);
            // Prefer 10th PV move if available, otherwise fallback to Stockfish's bestmove
            resolve(move ?? best);
        });

        // Launch search - a lower depth makes for weaker play.
        stockfishWorker.postMessage("go depth 2");

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

// Export initEngine so it can be preloaded
export { initEngine };

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
        console.error(`Browser Error ${e}`);
        return false;
    }

    // Growable shared memory (optional)
    try {
        mem.grow(8);
    } catch (e) {
        console.error(`Browser Error ${e}`);
        return false;
    }

    return true;
}

export interface AnalysisResult {
    bestMove: string;
    depth: number;
    evaluationCp?: number; // centipawns from white's perspective (+ means white is better)
    mateIn?: number; // positive number indicates mate in N moves for side to move
    pv?: string;
}

export async function analyzePosition(
    fen: string,
    targetDepth = 18
): Promise<AnalysisResult> {
    if (typeof window === "undefined") throw new Error("Engine can run only in browser");

    await initEngine();
    // Set engine to full strength for analysis.
    // This will only send commands if the strength is not already set to full.
    await setStrength(false);

    // Prepare position and wait for the engine to acknowledge with `readyok`.
    ready = false;
    stockfishWorker!.postMessage("ucinewgame");
    stockfishWorker!.postMessage(`position fen ${fen}`);
    stockfishWorker!.postMessage("isready");
    await waitUntilReady();

    return new Promise((resolve, reject) => {
        if (!stockfishWorker) return reject("Engine not initialised");

        let latestDepth = 0;
        let evaluationCp: number | undefined;
        let mateIn: number | undefined;
        let pv: string | undefined;

        // Temporary holders
        const handleInfo = (info: ParsedInfo) => {
            if (info.depth && info.depth >= latestDepth) {
                latestDepth = info.depth;
                if (info.score) {
                    if (info.score.unit === "cp") {
                        evaluationCp = info.score.value;
                    } else if (info.score.unit === "mate") {
                        mateIn = info.score.value;
                    }
                }
                if (info.pv) pv = info.pv;
            }
        };

        infoCallbacks.push(handleInfo);

        const timeout = setTimeout(() => {
            // Clean up
            const idx = infoCallbacks.indexOf(handleInfo);
            if (idx !== -1) infoCallbacks.splice(idx, 1);
            reject(new Error("Engine timeout"));
        }, 15000);

        pendingMoveResolvers.push((best) => {
            clearTimeout(timeout);
            // remove callback
            const idx = infoCallbacks.indexOf(handleInfo);
            if (idx !== -1) infoCallbacks.splice(idx, 1);

            resolve({
                bestMove: best,
                depth: latestDepth,
                evaluationCp,
                mateIn,
                pv,
            });
        });

        // Launch search
        stockfishWorker.postMessage(`go depth ${targetDepth}`);
    });
}