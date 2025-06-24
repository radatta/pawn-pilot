import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Chess, Move as ChessMove } from "chess.js";

interface UseReviewableGameOptions {
    /** Optional PGN to preload */
    pgn?: string;
    /** Attach global arrow-key navigation handlers (default true) */
    enableKeyboardNavigation?: boolean;
}

interface ReviewableGame {
    game: Chess;
    /** Call when an external move (e.g. user drag/drop) updates the game */
    updateGameExternal: (newGame: Chess) => void;
    /** Navigate one ply backward */
    stepBackward: () => void;
    /** Navigate one ply forward */
    stepForward: () => void;
    /** Jump to an arbitrary ply (0-based) */
    goToPly: (ply: number) => void;
    /** Full SAN history (static, does not shrink when navigating back) */
    fullSanHistory: string[];
    /** Index (0-based) of the current ply, or -1 for the starting position */
    currentPly: number;
    /** Replace current game with provided PGN */
    loadPGN: (pgnString: string) => void;
}

/**
 * Provides undo/redo and random-access navigation of a Chess.js game
 * while keeping the full move list static for UI display.
 */
export function useReviewableGame(options: UseReviewableGameOptions = {}): ReviewableGame {
    const { pgn, enableKeyboardNavigation = true } = options;

    const [game, _setGame] = useState(() => {
        const g = new Chess();
        if (pgn) {
            try {
                g.loadPgn(pgn);
            } catch {
                /* ignore invalid PGN */
            }
        }
        return g;
    });

    // Moves that have been undone and can be redone.
    const [futureMoves, setFutureMoves] = useState<ChessMove[]>([]);

    // Flag to tell the effect that the upcoming game state change is from navigation, not a new move.
    const isNavigatingRef = useRef(false);

    const setGame = useCallback(
        (g: Chess) => {
            _setGame(g);
        },
        []
    );

    const updateGameExternal = useCallback((newGame: Chess) => {
        // A brand-new move was made externally (drag/drop, engine, etc.).
        setFutureMoves([]);
        setGame(newGame);
    }, [setGame]);

    const stepBackward = useCallback(() => {
        if (game.history().length === 0) return;
        const copy = new Chess();
        copy.loadPgn(game.pgn());
        const undone = copy.undo();
        if (!undone) return;
        isNavigatingRef.current = true;
        setFutureMoves((prev) => [undone as ChessMove, ...prev]);
        setGame(copy);
    }, [game, setGame]);

    const stepForward = useCallback(() => {
        if (futureMoves.length === 0) return;
        const next = futureMoves[0];
        const copy = new Chess();
        copy.loadPgn(game.pgn());
        isNavigatingRef.current = true;
        copy.move({ from: next.from, to: next.to, promotion: (next as { promotion?: string }).promotion });
        setFutureMoves((prev) => prev.slice(1));
        setGame(copy);
    }, [futureMoves, game, setGame]);

    const goToPly = useCallback(
        (ply: number) => {
            const allSans: string[] = [...game.history(), ...futureMoves.map((m) => m.san)];

            if (ply < -1 || ply >= allSans.length) return;

            const newGame = new Chess();
            const newFuture: ChessMove[] = [];
            const replay = new Chess();
            // Build up to target ply and collect future moves.
            for (let i = 0; i < allSans.length; i++) {
                const moveObj = replay.move(allSans[i])!;
                if (i <= ply) {
                    newGame.move(allSans[i]);
                } else {
                    newFuture.push(moveObj as ChessMove);
                }
            }

            isNavigatingRef.current = true;
            setFutureMoves(newFuture);
            setGame(newGame);
        },
        [game, futureMoves, setGame]
    );

    // Static full SAN list – never shrinks while navigating.
    const fullSanHistory = useMemo(() => {
        console.log("fullSanHistory", [...game.history(), ...futureMoves.map((m) => m.san)]);
        return [...game.history(), ...futureMoves.map((m) => m.san)];
    }, [game, futureMoves]);

    const currentPly = game.history().length - 1;

    const loadPGN = useCallback(
        (pgnString: string) => {
            const g = new Chess();
            if (pgnString) {
                try {
                    g.loadPgn(pgnString);
                } catch {
                    /* ignore */
                }
            }
            setFutureMoves([]);
            setGame(g);
        },
        [setGame],
    );

    // Optional global keyboard navigation
    useEffect(() => {
        if (!enableKeyboardNavigation) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                stepBackward();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                stepForward();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [enableKeyboardNavigation, stepBackward, stepForward]);

    return {
        game,
        updateGameExternal,
        stepBackward,
        stepForward,
        goToPly,
        fullSanHistory,
        currentPly,
        loadPGN,
    };
} 