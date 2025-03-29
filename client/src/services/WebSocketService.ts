import { PlayerAction, PlayerView } from '../types/game';
import { Card, Rank, Suit } from '../types/game';

export class WebSocketService {
  private socket: WebSocket | null = null;
  private gameStateCallback: ((state: PlayerView) => void) | null = null;
  private connectionStatusCallback: ((connected: boolean) => void) | null = null;
  private errorCallback: ((error: string) => void) | null = null;

  constructor(private serverUrl: string = 'ws://localhost:8080') {}

  // Connect to the WebSocket server
  public connect(): void {
    if (this.socket) {
      this.socket.close();
    }

    try {
      this.socket = new WebSocket(this.serverUrl);

      this.socket.onopen = () => {
        console.log('WebSocket connection established');
        if (this.connectionStatusCallback) {
          this.connectionStatusCallback(true);
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          const gameState: PlayerView = this.parseGameState(raw);
          console.log('Received game state:', gameState);
          if (this.gameStateCallback) {
            this.gameStateCallback(gameState);
          }
        } catch (error) {
          console.error('Error parsing game state:', error);
          if (this.errorCallback) {
            this.errorCallback('Failed to parse game state');
          }
        }
      };

      this.socket.onclose = () => {
        console.log('WebSocket connection closed');
        if (this.connectionStatusCallback) {
          this.connectionStatusCallback(false);
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (this.errorCallback) {
          this.errorCallback('WebSocket connection error');
        }
      };
    } catch (error) {
      console.error('Failed to connect to WebSocket server:', error);
      if (this.errorCallback) {
        this.errorCallback('Failed to connect to game server');
      }
    }
  }

  // Disconnect from the WebSocket server
  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  // Send a player action to the server
  public sendAction(action: PlayerAction): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(action));
    } else {
      console.error('WebSocket not connected');
      if (this.errorCallback) {
        this.errorCallback('Not connected to game server');
      }
    }
  }

  // Play a card from the player's hand to a center pile
  public playCard(cardIndex: number): void {
    this.sendAction({
      PlayCard: {
        card_index: cardIndex,
      }
    });
  }

  // Request new center cards when no moves are possible
  public requestNewCenterCards(): void {
    this.sendAction({
      RequestNewCenterCards: null
    });
  }

  // Set callback for game state updates
  public onGameStateUpdate(callback: (state: PlayerView) => void): void {
    this.gameStateCallback = callback;
  }

  // Set callback for connection status changes
  public onConnectionStatusChange(callback: (connected: boolean) => void): void {
    this.connectionStatusCallback = callback;
  }

  // Set callback for errors
  public onError(callback: (error: string) => void): void {
    this.errorCallback = callback;
  }

  // Check if connected to the server
  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  private parseGameState(raw: any): PlayerView {
    const parseCard = (card: any): Card => ({
      suit: card.suit as Suit,
      rank: Rank[card.rank as keyof typeof Rank],  // "King" → Rank.King (13)
    });
  
    return {
      ...raw,
      hand: raw.hand.map(parseCard),
      center_piles: raw.center_piles.map((pile: any[]) => pile.map(parseCard))
    };
  }
}

// Create a singleton instance
export const webSocketService = new WebSocketService();
