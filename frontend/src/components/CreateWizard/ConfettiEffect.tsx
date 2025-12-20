import React, { useEffect, useState } from 'react';

interface ConfettiPiece {
  id: number;
  left: string;
  delay: string;
  color: string;
  duration: string;
}

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'];

export default function ConfettiEffect() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    // Generate confetti pieces on mount
    const newPieces: ConfettiPiece[] = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 2}s`,
      color: COLORS[i % COLORS.length],
      duration: `${2 + Math.random() * 2}s`,
    }));
    setPieces(newPieces);
  }, []);

  return (
    <div className="confetti-container">
      {pieces.map(piece => (
        <div
          key={piece.id}
          className="confetti-piece"
          style={{
            left: piece.left,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            backgroundColor: piece.color,
          }}
        />
      ))}
    </div>
  );
}
