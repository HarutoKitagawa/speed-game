import React from 'react';
import './App.css';
import GameComponent from './components/GameComponent';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Speed Card Game</h1>
        <p>A real-time multiplayer card game</p>
      </header>
      <main>
        <GameComponent />
      </main>
      <footer>
        <p>Connect with another player to start the game!</p>
      </footer>
    </div>
  );
}

export default App;
