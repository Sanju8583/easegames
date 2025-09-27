from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import random
import json
from datetime import datetime
import asyncio
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GameState(BaseModel):
    board: List[List[str]]
    stage: int
    matched_cells: List[str]
    score: int

class Player(BaseModel):
    name: str
    score: int
    date: str

# Store top players
players: List[Player] = []

# Get the absolute path for players.json
import os
PLAYERS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'players.json')

def save_players():
    try:
        with open(PLAYERS_FILE, 'w') as f:
            json.dump([{"name": p.name, "score": p.score, "date": p.date} for p in players], f, indent=2)
            print(f"Saved players to {PLAYERS_FILE}")
    except Exception as e:
        print(f"Error saving players to {PLAYERS_FILE}: {e}")

def load_players():
    try:
        if not os.path.exists(PLAYERS_FILE):
            with open(PLAYERS_FILE, 'w') as f:
                json.dump([], f)
            print(f"Created empty players file at {PLAYERS_FILE}")
            return []
            
        with open(PLAYERS_FILE, 'r') as f:
            data = json.load(f)
            loaded_players = [Player(**p) for p in data]
            print(f"Loaded {len(loaded_players)} players from {PLAYERS_FILE}")
            return loaded_players
    except Exception as e:
        print(f"Error loading players from {PLAYERS_FILE}: {e}", flush=True)
        return []

players = load_players()

def find_best_move(board: List[List[str]]) -> tuple[str, str]:
    """LLM strategy to find the best move"""
    # Create a flat list of all cells with their positions
    cells = []
    for i, row in enumerate(board):
        for j, value in enumerate(row):
            if value:  # If cell is not empty
                cells.append((f"{i}-{j}", value))
    
    # Find matching pairs (either equal or sum to 10)
    for i, (pos1, val1) in enumerate(cells):
        for pos2, val2 in cells[i+1:]:
            if val1 == val2 or int(val1) + int(val2) == 10:
                return pos1, pos2
    
    return None, None

@app.post("/api/llm-play")
async def llm_play():
    """Play 20 games automatically using LLM strategy"""
    total_score = 0
    games_played = 0
    start_time = datetime.now()
    
    while games_played < 20:
        game_start = datetime.now()
        # Initialize new game
        stage = 1
        score = 0
        board = [[str(random.randint(1, 9)) for _ in range(8)]]
        matched = set()
        
        print(f"Starting game {games_played + 1}/20")
        while stage <= 8:
            move1, move2 = find_best_move(board)
            if move1 is None or move2 is None:
                break
                
            # Mark cells as matched
            matched.add(move1)
            matched.add(move2)
            
            # Check if stage is complete
            if len(matched) == len(board) * 8:
                stage += 1
                score += 100 * stage
                if stage <= 8:
                    board.append([str(random.randint(1, 9)) for _ in range(8)])
        
        total_score += score
        games_played += 1
        
        game_time = (datetime.now() - game_start).total_seconds()
        print(f"Completed game {games_played}/20 with score {score} in {game_time:.1f} seconds")
        
        # Save score
        player = Player(
            name=f"LLM_Player_{games_played}",
            score=score,
            date=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )
        players.append(player)
        save_players()
        
        # Small delay to not overload
        await asyncio.sleep(0.1)
    
    total_time = (datetime.now() - start_time).total_seconds()
    avg_time_per_game = total_time / 20
    return {
        "message": f"Played {games_played} games, average score: {total_score/games_played}",
        "total_time": total_time,
        "average_time_per_game": avg_time_per_game,
        "total_score": total_score
    }

@app.get("/api/top-players")
async def get_top_players():
    """Get top 10 players by score"""
    sorted_players = sorted(players, key=lambda x: x.score, reverse=True)
    return sorted_players[:10]

# Add a root endpoint
@app.get("/")
async def root():
    return {"message": "Welcome to the game server! Available endpoints: /api/llm-play and /api/top-players"}

# Run on startup
@app.on_event("startup")
async def startup_event():
    global players
    players = load_players()
    print("Server started! Available endpoints: /api/llm-play and /api/top-players")

# Run on shutdown
@app.on_event("shutdown")
async def shutdown_event():
    save_players()
    print("Server shutting down, saved players data")