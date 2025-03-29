# Speed Game

A real-time multiplayer card game implementation of Speed using WebSocket for client-server communication.

## Technology Stack

### Backend
- Rust
- WebSocket server (using Tokio and Warp)
- Game logic implementation

### Frontend
- TypeScript
- React for UI components
- Phaser.js for game rendering
- WebSocket client for real-time communication

## Project Structure

```
speed-game/
├── client/                 # Frontend code
│   ├── public/             # Static assets
│   ├── src/                # Source code
│   │   ├── assets/         # Game assets (images, sounds)
│   │   ├── components/     # React components
│   │   ├── game/           # Phaser game implementation
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # Services (WebSocket, etc.)
│   │   └── types/          # TypeScript type definitions
│   ├── package.json        # Frontend dependencies
│   └── tsconfig.json       # TypeScript configuration
│
└── server/                 # Backend code
    ├── src/                # Source code
    │   ├── game/           # Game logic
    │   ├── websocket/      # WebSocket server implementation
    │   └── main.rs         # Entry point
    ├── Cargo.toml          # Rust dependencies
    └── Cargo.lock          # Lock file for dependencies
```

## Game Rules

Speed is a real-time card game where two players try to get rid of all their cards as quickly as possible:

1. Each player starts with a pile of cards.
2. There are two center piles where players can place cards.
3. Players can place a card if it's one higher or one lower than the top card of a center pile.
4. If neither player can make a move, new cards are dealt to the center piles.
5. The first player to get rid of all their cards wins.

## Development

### Backend
```bash
cd server
cargo run
```

### Frontend
```bash
cd client
npm install
npm start
