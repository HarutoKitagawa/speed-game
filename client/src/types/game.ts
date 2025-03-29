// Card suits
export enum Suit {
  Hearts = "Hearts",
  Diamonds = "Diamonds",
  Clubs = "Clubs",
  Spades = "Spades",
}

// Card ranks
export enum Rank {
  Ace = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
  Jack = 11,
  Queen = 12,
  King = 13,
}

// Card representation
export interface Card {
  suit: Suit;
  rank: Rank;
}

// Player actions
export type PlayerAction = 
  | { PlayCard: { card_index: number } }
  | { RequestNewCenterCards: null };

// Player view of the game state
export interface PlayerView {
  player_id: string;
  hand: Card[];
  draw_pile_count: number;
  opponent_hand_count: number;
  opponent_draw_pile_count: number;
  center_piles: Card[][];
  game_started: boolean;
  winner: string | null;
}
