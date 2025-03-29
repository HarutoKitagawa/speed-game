use futures_util::{SinkExt, StreamExt};
use log::{error, info, warn};
use std::collections::HashMap;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use std::sync::Arc;
use tokio_tungstenite::{accept_async, tungstenite::protocol::Message};
use uuid::Uuid;

use crate::game::{GameCommand, GameState, PlayerAction, PlayerView};

// Type for a player's WebSocket sender
type PlayerSender = futures_util::stream::SplitSink<
    tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
    tokio_tungstenite::tungstenite::protocol::Message,
>;

// Type for connected players
type Players = Arc<Mutex<HashMap<Uuid, PlayerSender>>>;

// Game state shared between all connections
type SharedGameState = Arc<Mutex<GameState>>;

// Helper function to send game state to a player
async fn send_game_state_to_player(
    players: &Players,
    player_id: Uuid,
    view: &PlayerView,
) -> Result<(), Box<dyn std::error::Error>> {
    // Serialize to JSON
    let json = serde_json::to_string(view)?;
    
    // Get the player's sender
    let mut players_lock = players.lock().await;
    if let Some(sender) = players_lock.get_mut(&player_id) {
        // Send the message
        sender.send(Message::Text(json)).await?;
    }
    
    Ok(())
}

pub async fn run_websocket_server(listener: TcpListener) -> Result<(), Box<dyn std::error::Error>> {
    // Initialize shared state
    let players: Players = Arc::new(Mutex::new(HashMap::new()));
    let game_state = Arc::new(Mutex::new(GameState::new()));
    
    // Accept connections
    while let Ok((stream, addr)) = listener.accept().await {
        info!("New connection from: {}", addr);
        
        // Clone the shared state for this connection
        let players_clone = players.clone();
        let game_state_clone = game_state.clone();
        
        // Spawn a new task for each connection
        tokio::spawn(async move {
            if let Err(e) = handle_connection(stream, players_clone, game_state_clone).await {
                error!("Error handling connection: {}", e);
            }
        });
    }
    
    Ok(())
}

async fn handle_connection(
    stream: TcpStream,
    players: Players,
    game_state: SharedGameState,
) -> Result<(), Box<dyn std::error::Error>> {
    // Accept the WebSocket connection
    let ws_stream = accept_async(stream).await?;
    info!("WebSocket connection established");
    
    // Generate a unique ID for this player
    let player_id = Uuid::new_v4();
    info!("Assigned player ID: {}", player_id);
    
    // Split the WebSocket stream
    let (ws_sender, mut ws_receiver) = ws_stream.split();
    
    // Add the player to our connected players
    {
        let mut players_lock = players.lock().await;
        players_lock.insert(player_id, ws_sender);
        
        // If we have two players, start the game
        if players_lock.len() == 2 {
            info!("Two players connected, starting game");
            
            // Add players to the game
            let mut game = game_state.lock().await;
            for &id in players_lock.keys() {
                game.add_player(id);
            }
            
            // Start the game
            game.start_game();
            
            // Create player views
            let player_views: Vec<_> = players_lock.keys().map(|&id| {
                (id, game.create_player_view(id))
            }).collect();
            
            // Drop locks before async operations
            drop(game);
            drop(players_lock);
            
            // Send initial game state to all players
            for (id, view) in player_views {
                send_game_state_to_player(&players, id, &view).await?;
            }
        } else if players_lock.len() > 2 {
            // We only support 2 players for now
            warn!("More than 2 players connected, spectator mode not implemented");
            // TODO: Implement spectator mode or waiting queue
        }
    }
    
    // Handle incoming messages
    while let Some(result) = ws_receiver.next().await {
        match result {
            Ok(msg) => {
                if msg.is_text() || msg.is_binary() {
                    // Parse the message as a player action
                    if let Ok(action) = serde_json::from_str::<PlayerAction>(msg.to_text()?) {
                        // Process the action
                        let command = GameCommand {
                            player_id,
                            action,
                        };
                        
                        // Update game state
                        let mut game = game_state.lock().await;
                        game.process_command(command);
                        
                        // Create player views
                        let mut player_views = Vec::new();
                        let players_lock = players.lock().await;
                        
                        for &id in players_lock.keys() {
                            player_views.push((id, game.create_player_view(id)));
                        }
                        
                        // Drop locks before async operations
                        drop(game);
                        drop(players_lock);
                        
                        // Send updated state to all players
                        for (id, view) in player_views {
                            if let Err(e) = send_game_state_to_player(&players, id, &view).await {
                                error!("Error sending game state to player {}: {}", id, e);
                            }
                        }
                    } else {
                        warn!("Received invalid message format");
                    }
                }
            }
            Err(e) => {
                error!("Error receiving message: {}", e);
                break;
            }
        }
    }
    
    // Player disconnected, remove from our list
    {
        let mut players_lock = players.lock().await;
        players_lock.remove(&player_id);
        info!("Player {} disconnected", player_id);
        
        // Reset game if a player disconnects
        if !players_lock.is_empty() {
            let mut game = game_state.lock().await;
            *game = GameState::new();
            
            // Add remaining players to the new game state
            for &id in players_lock.keys() {
                game.add_player(id);
            }
            
            info!("Game reset due to player disconnect");
            
            // Create player views
            let player_views: Vec<_> = players_lock.keys().map(|&id| {
                (id, game.create_player_view(id))
            }).collect();
            
            // Drop locks before async operations
            drop(game);
            drop(players_lock);
            
            // Notify remaining players
            for (id, view) in player_views {
                if let Err(e) = send_game_state_to_player(&players, id, &view).await {
                    error!("Error sending game state to player {}: {}", id, e);
                }
            }
        }
    }
    
    Ok(())
}
