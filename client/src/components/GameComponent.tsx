import React, { useEffect, useRef } from 'react';
import { SpeedGame } from '../game/SpeedGame';
import { webSocketService } from '../services/WebSocketService';

const GameComponent: React.FC = () => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<SpeedGame | null>(null);

  useEffect(() => {
    // Initialize the game when the component mounts
    if (gameContainerRef.current && !gameInstanceRef.current) {
      gameInstanceRef.current = new SpeedGame('game-container');
    }

    // Clean up the game when the component unmounts
    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy();
        gameInstanceRef.current = null;
      }
      
      // Disconnect from the WebSocket server
      webSocketService.disconnect();
    };
  }, []);

  return (
    <div className="game-wrapper">
      <div id="game-container" ref={gameContainerRef} style={{ width: '100%', height: '600px' }} />
    </div>
  );
};

export default GameComponent;
