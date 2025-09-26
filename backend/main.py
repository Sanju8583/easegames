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

def save_players():
    with open('players.json', 'w') as f:
        json.dump([p.dict() for p in players], f)

def load_players():
    try:
        with open('players.json', 'r') as f:
            data = json.load(f)
            return [Player(**p) for p in data]
    except:
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
    
    while games_played < 20:
        # Initialize new game
        stage = 1
        score = 0
        board = [[str(random.randint(1, 9)) for _ in range(8)]]
        matched = set()
        
        while stage <= 8:
            move1, move2 = find_best_move(board)
            if not move1 or not move2:
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
    
    return {"message": f"Played {games_played} games, average score: {total_score/games_played}"}

@app.get("/api/top-players")
async def get_top_players():
    """Get top 10 players by score"""
    sorted_players = sorted(players, key=lambda x: x.score, reverse=True)
    return sorted_players[:10]

# Run on startup
@app.on_event("startup")
async def startup_event():
    global players
    players = load_players()