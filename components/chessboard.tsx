"use client";

import { useState, useEffect } from "react";
import { Chess } from "chess.js";
import { Chessboard as ReactChessboard } from "react-chessboard";

interface ChessboardProps {
  game: Chess;
  setGame: (game: Chess) => void;
  flipped?: boolean;
}

export function Chessboard({ game, setGame, flipped = false }: ChessboardProps) {
  // Kludgy fix for initial hydration mismatch because react-chessboard
  // is not SSR-friendly.
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  function onDrop(sourceSquare: string, targetSquare: string) {
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
        setGame(gameCopy);
      }
      return move !== null;
    } catch {
      // illegal move
      return false;
    }
  }

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
      />
    </div>
  );
}
