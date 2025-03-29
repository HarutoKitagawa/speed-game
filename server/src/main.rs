mod game;
mod websocket;

use log::info;
use std::env;
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logger
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("debug"));
    
    // Set up WebSocket server
    let addr = env::var("BIND_ADDRESS").unwrap_or_else(|_| "127.0.0.1:8080".to_string());
    info!("Starting Speed game server on {}", addr);
    
    let listener = TcpListener::bind(&addr).await?;
    info!("WebSocket server listening on: {}", addr);
    
    // Accept and handle connections
    websocket::run_websocket_server(listener).await?;
    
    Ok(())
}
