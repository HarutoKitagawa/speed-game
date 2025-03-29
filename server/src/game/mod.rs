use rand::seq::SliceRandom;
use rand::thread_rng;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use uuid::Uuid;

// Card representation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Card {
    pub suit: Suit,
    pub rank: Rank,
}

// Card suits
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Suit {
    Hearts,
    Diamonds,
    Clubs,
    Spades,
}

// Card ranks
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Rank {
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

impl Rank {
    // Check if this rank can be played on top of another rank
    pub fn can_play_on(&self, other: &Rank) -> bool {
        let self_val = *self as u8;
        let other_val = *other as u8;
        
        // In Speed, you can play a card that's one higher or one lower
        // With wrapping (King can be played on Ace and vice versa)
        if self_val == 1 && other_val == 13 {
            return true;
        }
        if self_val == 13 && other_val == 1 {
            return true;
        }
        
        (self_val as i16 - other_val as i16).abs() == 1
    }
}

// Game state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameState {
    pub players: Vec<PlayerState>,
    pub center_piles: Vec<Vec<Card>>,
    pub deck: Vec<Card>,
    pub game_started: bool,
    pub winner: Option<Uuid>,
}

// Player state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerState {
    pub id: Uuid,
    pub hand: Vec<Card>,
    pub draw_pile: VecDeque<Card>,
}

// Player-specific view of the game state
#[derive(Debug, Serialize, Deserialize)]
pub struct PlayerView {
    pub player_id: Uuid,
    pub hand: Vec<Card>,
    pub draw_pile_count: usize,
    pub opponent_hand_count: usize,
    pub opponent_draw_pile_count: usize,
    pub center_piles: Vec<Vec<Card>>,
    pub game_started: bool,
    pub winner: Option<Uuid>,
}

// Actions a player can take
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PlayerAction {
    PlayCard { card_index: usize },
    RequestNewCenterCards,
}

// Command from a player
#[derive(Debug, Clone)]
pub struct GameCommand {
    pub player_id: Uuid,
    pub action: PlayerAction,
}

impl GameState {
    // Create a new game state
    pub fn new() -> Self {
        GameState {
            players: Vec::new(),
            center_piles: vec![Vec::new(), Vec::new()],
            deck: create_deck(),
            game_started: false,
            winner: None,
        }
    }
    
    // Start the game
    pub fn start_game(&mut self) {
        if self.players.len() != 2 {
            return;
        }
        
        // Shuffle the deck
        let mut rng = thread_rng();
        self.deck.shuffle(&mut rng);
        
        // Deal cards to players
        self.deal_cards();
        
        // Deal initial center cards
        self.deal_center_cards();
        
        self.game_started = true;
    }
    
    // Deal cards to players
    fn deal_cards(&mut self) {
        // Each player gets 5 cards in hand and 15 in draw pile
        for player in &mut self.players {
            // Deal 5 cards to hand
            for _ in 0..5 {
                if let Some(card) = self.deck.pop() {
                    player.hand.push(card);
                }
            }
            
            // Deal 15 cards to draw pile
            for _ in 0..15 {
                if let Some(card) = self.deck.pop() {
                    player.draw_pile.push_back(card);
                }
            }
        }
    }
    
    // Deal cards to the center piles
    fn deal_center_cards(&mut self) {
        for pile in &mut self.center_piles {
            if let Some(card) = self.deck.pop() {
                pile.push(card);
            }
        }
    }
    
    // Add a player to the game
    pub fn add_player(&mut self, id: Uuid) -> bool {
        if self.players.len() >= 2 {
            return false;
        }
        
        self.players.push(PlayerState {
            id,
            hand: Vec::new(),
            draw_pile: VecDeque::new(),
        });
        
        true
    }
    
    // Process a command from a player
    pub fn process_command(&mut self, command: GameCommand) {
        if !self.game_started || self.winner.is_some() {
            return;
        }
        
        match command.action {
            PlayerAction::PlayCard { card_index } => {
                self.play_card(command.player_id, card_index);
            }
            PlayerAction::RequestNewCenterCards => {
                self.request_new_center_cards();
            }
        }
        
        // Check for a winner
        self.check_winner();
    }
    
    // Play a card from a player's hand to a center pile
    fn play_card(&mut self, player_id: Uuid, card_index: usize) {
        // Find the player
        let player_index = self.players.iter().position(|p| p.id == player_id);
        if player_index.is_none() {
            return;
        }
        let player_index = player_index.unwrap();
        
        // Check if the indices are valid
        if card_index >= self.players[player_index].hand.len() {
            return;
        }
        
        // Get the card and the pile
        let card = self.players[player_index].hand[card_index];

        // Find a valid pile to play the card
        let mut selected_pile_index = None;
        for (i, pile) in self.center_piles.iter().enumerate() {
            if pile.is_empty() || card.rank.can_play_on(&pile.last().unwrap().rank) {
                selected_pile_index = Some(i);
                break;
            }
        }

        let pile_index = match selected_pile_index {
            Some(index) => index,
            None => return,
        };
        
        // Play the card
        self.players[player_index].hand.remove(card_index);
        self.center_piles[pile_index].push(card);
        
        // Draw a new card if available
        if let Some(new_card) = self.players[player_index].draw_pile.pop_front() {
            self.players[player_index].hand.push(new_card);
        }
    }
    
    // Request new center cards when no moves are possible
    fn request_new_center_cards(&mut self) {
        // Check if there are cards left in the deck
        if self.deck.is_empty() {
            return;
        }
        
        // Deal new center cards
        for pile in &mut self.center_piles {
            if let Some(card) = self.deck.pop() {
                pile.push(card);
            }
        }
    }
    
    // Check if there's a winner
    fn check_winner(&mut self) {
        for player in &self.players {
            if player.hand.is_empty() && player.draw_pile.is_empty() {
                self.winner = Some(player.id);
                break;
            }
        }
    }
    
    // Create a player-specific view of the game state
    pub fn create_player_view(&self, player_id: Uuid) -> PlayerView {
        // Find the player
        let player_index = self.players.iter().position(|p| p.id == player_id).unwrap_or(0);
        
        // Get player info
        let player = &self.players[player_index];
        
        // Get opponent info if there is one
        let (opponent_hand_count, opponent_draw_pile_count) = if self.players.len() > 1 {
            let opponent_index = if player_index == 0 { 1 } else { 0 };
            let opponent = &self.players[opponent_index];
            (opponent.hand.len(), opponent.draw_pile.len())
        } else {
            // No opponent
            (0, 0)
        };
        
        PlayerView {
            player_id,
            hand: player.hand.clone(),
            draw_pile_count: player.draw_pile.len(),
            opponent_hand_count,
            opponent_draw_pile_count,
            center_piles: self.center_piles.clone(),
            game_started: self.game_started,
            winner: self.winner,
        }
    }
}

// Create a standard deck of 52 cards
fn create_deck() -> Vec<Card> {
    let mut deck = Vec::with_capacity(52);
    
    for &suit in &[Suit::Hearts, Suit::Diamonds, Suit::Clubs, Suit::Spades] {
        for rank in 1..=13 {
            let rank = match rank {
                1 => Rank::Ace,
                2 => Rank::Two,
                3 => Rank::Three,
                4 => Rank::Four,
                5 => Rank::Five,
                6 => Rank::Six,
                7 => Rank::Seven,
                8 => Rank::Eight,
                9 => Rank::Nine,
                10 => Rank::Ten,
                11 => Rank::Jack,
                12 => Rank::Queen,
                13 => Rank::King,
                _ => unreachable!(),
            };
            
            deck.push(Card { suit, rank });
        }
    }
    
    deck
}
