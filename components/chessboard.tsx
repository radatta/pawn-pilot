import React, { useState, useEffect, useRef, useMemo } from "react";
import { Chess, Square } from "chess.js";
import { Chessboard as ReactChessboard } from "react-chessboard";
import Image from "next/image";

interface ChessboardProps {
  game: Chess;
  setGame: (game: Chess) => void;
  flipped?: boolean;
  arrows?: [Square, Square, string][];
  disabled?: boolean;
}

export function Chessboard({
  game,
  setGame,
  flipped = false,
  arrows,
  disabled = false,
}: ChessboardProps) {
  // Kludgy fix for initial hydration mismatch because react-chessboard
  // is not SSR-friendly.
  const [isMounted, setIsMounted] = useState(false);
  // NEW: Audio refs for move / capture sounds
  const moveSoundRef = useRef<HTMLAudioElement | null>(null);
  const captureSoundRef = useRef<HTMLAudioElement | null>(null);

  // Track previous game state to detect AI moves
  const prevGameRef = useRef<string>("");
  const userMoveRef = useRef<boolean>(false);

  useEffect(() => {
    // Using Chess.com piece move sounds (publicly available)
    moveSoundRef.current = new Audio("/sounds/move-self.mp3");
    captureSoundRef.current = new Audio("/sounds/capture.mp3");
    // notificationSoundRef.current = new Audio("/sounds/notification.mp3");
    setIsMounted(true);
  }, []);

  // Detect AI moves and play sounds
  useEffect(() => {
    const currentPgn = game.pgn();

    // If this is not the initial load and the game has changed
    if (
      prevGameRef.current &&
      prevGameRef.current !== currentPgn &&
      !userMoveRef.current
    ) {
      // This means the game changed but not from a user move (likely AI move)
      const history = game.history({ verbose: true });
      if (history.length > 0) {
        const lastMove = history[history.length - 1];
        // Play sound based on whether it was a capture
        playSound(!!lastMove.captured);
      }
    }

    // Update the previous game state
    prevGameRef.current = currentPgn;
    // Reset user move flag
    userMoveRef.current = false;
  }, [game]);

  // --- Click-to-move state ---
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);

  // Helper: get legal moves for a square
  function getLegalMoves(square: string): string[] {
    const moves = game.moves({ square: square as Square, verbose: true }) as {
      to: string;
    }[];
    return moves.map((move) => move.to);
  }

  // Helper: Play move / capture sound without blocking subsequent plays
  function playSound(capture: boolean) {
    const srcRef = capture ? captureSoundRef.current : moveSoundRef.current;
    if (!srcRef) return;
    // cloneNode allows parallel overlapping plays
    (srcRef.cloneNode() as HTMLAudioElement).play().catch(() => {});
  }

  // --- Drag-and-drop handler ---
  function onDrop(sourceSquare: string, targetSquare: string) {
    if (disabled) return false;

    // Create a new instance and load the PGN to preserve history
    const gameCopy = new Chess();
    gameCopy.loadPgn(game.pgn());

    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q", // always promote to a queen for simplicity
      });
      // If the move is legal, update the state
      if (move) {
        // Flag this as a user move
        userMoveRef.current = true;
        playSound(!!move.captured);
        setGame(gameCopy);
        setSelectedSquare(null);
        setLegalMoves([]);
      }
      return move !== null;
    } catch {
      // illegal move
      return false;
    }
  }

  // --- Click handlers ---
  function onPieceClick(piece: string, square: string) {
    if (disabled) return;
    const turn = game.turn();
    if (
      (turn === "w" && piece.startsWith("w")) ||
      (turn === "b" && piece.startsWith("b"))
    ) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setLegalMoves([]);
      } else {
        setSelectedSquare(square);
        setLegalMoves(getLegalMoves(square));
      }
    }
  }

  function onSquareClick(square: string, piece?: string) {
    if (disabled) return;
    if (selectedSquare === square) {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }
    if (selectedSquare) {
      // If clicked square is a legal move, move there
      if (legalMoves.includes(square)) {
        // Flag this as a user move before calling onDrop
        userMoveRef.current = true;
        onDrop(selectedSquare, square);
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }
      // If clicked another of your pieces, select it
      if (
        piece &&
        ((game.turn() === "w" && piece.startsWith("w")) ||
          (game.turn() === "b" && piece.startsWith("b")))
      ) {
        setSelectedSquare(square);
        setLegalMoves(getLegalMoves(square));
        return;
      }
      // Otherwise, clear selection
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }

  // --- Drag handlers ---
  function onPieceDragBegin(piece: string, sourceSquare: string) {
    if (disabled) return;
    document.body.style.cursor = "grabbing";
    setSelectedSquare(sourceSquare);
    setLegalMoves(getLegalMoves(sourceSquare));
  }

  function onPieceDragEnd() {
    if (disabled) return;
    document.body.style.cursor = "auto";
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  // --- Highlighting ---
  const customSquareStyles: Record<string, React.CSSProperties> = {};

  // Highlight the last move (destination square in orange)
  const history = game.history({ verbose: true });
  if (history.length > 0) {
    const lastMove = history[history.length - 1];
    customSquareStyles[lastMove.to] = {
      background: "#eab30888",
    };
  }

  if (!disabled && selectedSquare) {
    customSquareStyles[selectedSquare] = {
      background: "#eab30888",
    };
    legalMoves.forEach((sq) => {
      customSquareStyles[sq] = {
        background: "radial-gradient(circle, #888 20%, transparent 20%)",
      };
    });
  }

  // --- Custom piece rendering (scale + shadow on drag) ---
  const customPieces = useMemo(() => {
    const pieces: Record<
      string,
      (opts: { isDragging: boolean; squareWidth: number }) => React.ReactElement
    > = {};
    const names = [
      "wP",
      "wN",
      "wB",
      "wR",
      "wQ",
      "wK",
      "bP",
      "bN",
      "bB",
      "bR",
      "bQ",
      "bK",
    ];
    names.forEach((name) => {
      pieces[name] = ({ isDragging, squareWidth }) => (
        <Image
          src={`/pieces/${name.toLowerCase()}.png`}
          alt=""
          style={{
            width: squareWidth,
            height: squareWidth,
            transform: isDragging ? "scale(1.15)" : "scale(1)",
            filter: isDragging ? "drop-shadow(0 4px 10px rgba(0,0,0,0.6))" : "none",
            transition: "transform 0.1s ease-out, filter 0.1s ease-out",
            pointerEvents: "none",
          }}
          draggable={false}
          width={squareWidth}
          height={squareWidth}
        />
      );
    });
    return pieces;
  }, []);

  if (!isMounted) {
    return (
      <div className="w-full max-w-[600px] aspect-square border-2 border-primary/20 rounded-lg overflow-hidden shadow-2xl bg-muted" />
    );
  }

  return (
    <div className="w-full max-w-[600px] aspect-square border-2 border-primary/20 rounded-lg overflow-hidden shadow-2xl">
      <ReactChessboard
        position={game.fen()}
        onPieceDrop={onDrop}
        boardOrientation={flipped ? "black" : "white"}
        onPieceClick={onPieceClick}
        onSquareClick={onSquareClick}
        onPieceDragBegin={onPieceDragBegin}
        onPieceDragEnd={onPieceDragEnd}
        customSquareStyles={customSquareStyles}
        customArrows={arrows}
        customPieces={customPieces}
        arePiecesDraggable={!disabled}
      />
    </div>
  );
}
