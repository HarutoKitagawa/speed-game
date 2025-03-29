import Phaser from 'phaser';
import { Card, PlayerView, Rank, Suit } from '../types/game';
import { webSocketService } from '../services/WebSocketService';

export class SpeedScene extends Phaser.Scene {
  // Game state
  private gameState: PlayerView | null = null;
  
  // Card sprites
  private playerCards: Phaser.GameObjects.Sprite[] = [];
  private centerPiles: Phaser.GameObjects.Sprite[] = [];
  
  // UI elements
  private statusText!: Phaser.GameObjects.Text;
  private drawPileText!: Phaser.GameObjects.Text;
  private opponentHandText!: Phaser.GameObjects.Text;
  private opponentDrawPileText!: Phaser.GameObjects.Text;
  private newCardsButton!: Phaser.GameObjects.Text;
  
  // Card dimensions
  private cardWidth = 80;
  private cardHeight = 120;
  
  constructor() {
    super('SpeedScene');
  }
  
  preload() {
    // Try to load card images, but don't fail if they're missing
    this.load.image('card_back', 'assets/card_back.png').on('loaderror', () => {
      console.warn('Card back image not found, using placeholder');
      this.createPlaceholderCardTexture('card_back', 0x1a6dd9);
    });
    
    // Load card fronts for each suit and rank
    const suits = [Suit.Hearts, Suit.Diamonds, Suit.Clubs, Suit.Spades];
    const ranks = [
      Rank.Ace, Rank.Two, Rank.Three, Rank.Four, Rank.Five, 
      Rank.Six, Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten,
      Rank.Jack, Rank.Queen, Rank.King
    ];
    
    // Define suit colors
    const suitColors = {
      [Suit.Hearts]: 0xff0000,
      [Suit.Diamonds]: 0xff0000,
      [Suit.Clubs]: 0x000000,
      [Suit.Spades]: 0x000000
    };
    
    suits.forEach(suit => {
      ranks.forEach(rank => {
        const key = `card_${suit}_${rank}`;
        this.load.image(key, `assets/${key}.png`).on('loaderror', () => {
          console.warn(`Card image not found: ${key}, using placeholder`);
          this.createPlaceholderCardTexture(key, suitColors[suit], rank);
        });
      });
    });
  }
  
  // Create a placeholder card texture if image is missing
  private createPlaceholderCardTexture(key: string, color: number, rank?: number) {
    const graphics = this.add.graphics();
    
    // Draw card background (white)
    graphics.fillStyle(0xffffff);
    graphics.fillRect(0, 0, this.cardWidth, this.cardHeight);
    
    // Draw card border
    graphics.lineStyle(2, 0x000000);
    graphics.strokeRect(0, 0, this.cardWidth, this.cardHeight);
    
    // Draw suit color in the center
    graphics.fillStyle(color);
    graphics.fillRect(10, 10, this.cardWidth - 20, this.cardHeight - 20);
    
    // Add rank text if provided
    if (rank !== undefined) {
      const rankText = this.add.text(this.cardWidth / 2, this.cardHeight / 2, rank.toString(), {
        fontSize: '32px',
        color: '#ffffff'
      }).setOrigin(0.5);
      
      // Special symbols for face cards
      if (rank === Rank.Jack) rankText.setText('J');
      if (rank === Rank.Queen) rankText.setText('Q');
      if (rank === Rank.King) rankText.setText('K');
      if (rank === Rank.Ace) rankText.setText('A');
    }
    
    // Generate texture from the graphics object
    graphics.generateTexture(key, this.cardWidth, this.cardHeight);
    
    // Clean up the graphics object
    graphics.destroy();
  }
  
  create() {
    // Set up WebSocket callbacks
    webSocketService.onGameStateUpdate(this.updateGameState.bind(this));
    webSocketService.onConnectionStatusChange(this.updateConnectionStatus.bind(this));
    webSocketService.onError(this.showError.bind(this));
    
    // Connect to the server
    webSocketService.connect();
    
    // Create UI elements
    this.createUI();
    
    // Initial state
    this.updateConnectionStatus(false);
  }
  
  private createUI() {
    const { width, height } = this.scale;
    
    // Status text
    this.statusText = this.add.text(width / 2, 30, 'Connecting to server...', {
      fontSize: '18px',
      color: '#fff'
    }).setOrigin(0.5);
    
    // Player info
    this.drawPileText = this.add.text(width - 20, height - 20, 'Draw Pile: 0', {
      fontSize: '16px',
      color: '#fff'
    }).setOrigin(1, 1);
    
    // Opponent info
    this.opponentHandText = this.add.text(20, 20, 'Opponent Hand: 0', {
      fontSize: '16px',
      color: '#fff'
    }).setOrigin(0, 0);
    
    this.opponentDrawPileText = this.add.text(20, 50, 'Opponent Draw Pile: 0', {
      fontSize: '16px',
      color: '#fff'
    }).setOrigin(0, 0);
    
    // New cards button
    this.newCardsButton = this.add.text(width / 2, height - 30, 'New Center Cards', {
      fontSize: '16px',
      color: '#fff',
      backgroundColor: '#1a6dd9',
      padding: { x: 10, y: 5 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        webSocketService.requestNewCenterCards();
      })
      .setVisible(false);
  }
  
  private updateGameState(state: PlayerView) {
    this.gameState = state;
    
    // Update status text
    if (!state.game_started) {
      this.statusText.setText('Waiting for another player to join...');
    } else if (state.winner) {
      const isWinner = state.winner === state.player_id;
      this.statusText.setText(isWinner ? 'You Win!' : 'You Lose!');
    } else {
      this.statusText.setText('Game in progress');
    }
    
    // Update player info
    this.drawPileText.setText(`Draw Pile: ${state.draw_pile_count}`);
    
    // Update opponent info
    this.opponentHandText.setText(`Opponent Hand: ${state.opponent_hand_count}`);
    this.opponentDrawPileText.setText(`Opponent Draw Pile: ${state.opponent_draw_pile_count}`);
    
    // Show/hide new cards button
    this.newCardsButton.setVisible(state.game_started && !state.winner);
    
    // Render cards
    this.renderCards();
  }
  
  private renderCards() {
    if (!this.gameState) return;
    
    const { width, height } = this.scale;
    
    // Clear existing cards
    this.playerCards.forEach(card => card.destroy());
    this.centerPiles.forEach(card => card.destroy());
    this.playerCards = [];
    this.centerPiles = [];
    
    // Render player's hand
    const handWidth = this.gameState.hand.length * (this.cardWidth + 10);
    const startX = (width - handWidth) / 2 + this.cardWidth / 2;
    
    this.gameState.hand.forEach((card, index) => {
      const x = startX + index * (this.cardWidth + 10);
      const y = height - this.cardHeight / 2 - 60;
      
      const cardSprite = this.add.sprite(x, y, this.getCardTexture(card))
        .setDisplaySize(this.cardWidth, this.cardHeight)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.onCardClick(index));
      
      this.playerCards.push(cardSprite);
    });
    
    // Render center piles
    const centerX = width / 2;
    const centerY = height / 2;
    const pileSpacing = this.cardWidth + 30;
    
    this.gameState.center_piles.forEach((pile, pileIndex) => {
      if (pile.length > 0) {
        const topCard = pile[pile.length - 1];
        const x = centerX + (pileIndex === 0 ? -pileSpacing / 2 : pileSpacing / 2);
        const y = centerY;
        
        const cardSprite = this.add.sprite(x, y, this.getCardTexture(topCard))
          .setDisplaySize(this.cardWidth, this.cardHeight);
        
        this.centerPiles.push(cardSprite);
      }
    });
  }
  
  private onCardClick(cardIndex: number) {
    if (!this.gameState || !this.gameState.game_started || this.gameState.winner) {
      return;
    }
    
    // Determine which pile to play on (closest one)
    const { width } = this.scale;
    const centerX = width / 2;
    const cardX = this.playerCards[cardIndex].x;
    
    // Play on left pile if card is on left side, right pile if on right side
    const pileIndex = cardX < centerX ? 0 : 1;
    
    // Send the action to the server
    webSocketService.playCard(cardIndex, pileIndex);
  }
  
  private getCardTexture(card: Card): string {
    return `card_${card.suit}_${card.rank}`;
  }
  
  private updateConnectionStatus(connected: boolean) {
    if (!connected) {
      this.statusText.setText('Connecting to server...');
    }
  }
  
  private showError(error: string) {
    this.statusText.setText(`Error: ${error}`);
  }
}
