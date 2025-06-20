import { useState, useEffect } from "react";
import { Chess, Square } from "chess.js";
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

  // --- Drag-and-drop handler ---
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
    if (selectedSquare === square) {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }
    if (selectedSquare) {
      // If clicked square is a legal move, move there
      if (legalMoves.includes(square)) {
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

  // --- Highlighting ---
  const customSquareStyles: Record<string, React.CSSProperties> = {};
  if (selectedSquare) {
    customSquareStyles[selectedSquare] = {
      background: "#eab30888",
    };
    legalMoves.forEach((sq) => {
      customSquareStyles[sq] = {
        background: "radial-gradient(circle, #888 20%, transparent 20%)",
      };
    });
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
        onPieceClick={onPieceClick}
        onSquareClick={onSquareClick}
        customSquareStyles={customSquareStyles}
      />
    </div>
  );
}
