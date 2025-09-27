import React, { useState, useEffect } from 'react';
import './ClickableTable.css';

interface Player {
  name: string;
  score: number;
  date: string;
}

const Table = () => {
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [prevCell, setPrevCell] = useState<string | null>(null);
  const [levelCompleted, setLevelCompleted] = useState(false);
  const [matchedCells, setMatchedCells] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState(1);
  const [score, setScore] = useState(0);
  const [playerName, setPlayerName] = useState("");
  const [topPlayers, setTopPlayers] = useState<Player[]>([]);
  const [isLLMPlaying, setIsLLMPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const maxStage = 4;

  // Place a pair of numbers in specific positions
  const placePair = (grid: string[][], row1: number, col1: number, row2: number, col2: number, num1: string, num2: string) => {
    grid[row1][col1] = num1;
    grid[row2][col2] = num2;
  };

  // Check if a position is available in the grid
  const isPositionEmpty = (grid: string[][], row: number, col: number) => {
    return grid[row][col] === '';
  };

  // Check if there's a valid path between two cells
  const hasValidPath = (grid: string[][], row1: number, col1: number, row2: number, col2: number, filledCells: Set<string>): boolean => {
    // Must be in same row or column
    if (row1 !== row2 && col1 !== col2) return false;

    if (row1 === row2) {
      // Same row - check if path is clear
      const minCol = Math.min(col1, col2);
      const maxCol = Math.max(col1, col2);
      for (let col = minCol + 1; col < maxCol; col++) {
        if (!filledCells.has(`${row1}-${col}`)) {
          return true; // Found a clear path
        }
      }
    }

    if (col1 === col2) {
      // Same column - check if path is clear
      const minRow = Math.min(row1, row2);
      const maxRow = Math.max(row1, row2);
      for (let row = minRow + 1; row < maxRow; row++) {
        if (!filledCells.has(`${row}-${col1}`)) {
          return true; // Found a clear path
        }
      }
    }

    return false;
  };

  // Generate the entire grid with AI-guided strategic pair placement
  const generateGrid = (currentStage: number): string[][] => {
    const rows = currentStage;
    const cols = 8;
    
    // AI-guided difficulty scaling
    const difficultyConfig = {
      equalPairChance: Math.max(0.9 - (currentStage * 0.2), 0.3), // More equal pairs in early stages
      preferRowPlacement: currentStage <= 2, // Prefer row placements in early stages
      maxGapBetweenPairs: Math.min(3 + currentStage, 6), // Gradually increase maximum gap
      clusterProbability: Math.max(0.8 - (currentStage * 0.15), 0.3) // Cluster similar numbers in early stages
    };

    // Initialize grid with optimal spacing
    const grid: string[][] = Array(rows).fill(null).map(() => Array(cols).fill(''));
    const filledCells = new Set<string>();
    const usedNumbers = new Set<number>();
    const pairs: Array<[string, string, number]> = []; // Third number is pair difficulty rating

    // Generate pairs with difficulty ratings
    const pairsNeeded = (rows * cols) / 2;
    for (let i = 0; i < pairsNeeded; i++) {
      if (Math.random() < difficultyConfig.equalPairChance) {
        // Equal pair (easier)
        let num;
        do {
          num = Math.floor(Math.random() * 9) + 1;
        } while (usedNumbers.has(num));
        pairs.push([num.toString(), num.toString(), 1]); // Difficulty rating 1 (easy)
        usedNumbers.add(num);
      } else {
        // Sum to 10 pair (harder)
        let num1;
        do {
          num1 = Math.floor(Math.random() * 9) + 1;
        } while (usedNumbers.has(num1) || usedNumbers.has(10 - num1));
        const num2 = 10 - num1;
        pairs.push([num1.toString(), num2.toString(), 2]); // Difficulty rating 2 (harder)
        usedNumbers.add(num1);
        usedNumbers.add(num2);
      }
    }

    // Sort pairs by difficulty - place easier pairs first in early stages
    if (currentStage <= 2) {
      pairs.sort((a, b) => a[2] - b[2]);
    } else {
      // Mix difficulties in later stages
      pairs.sort(() => Math.random() - 0.5);
    }

    // Smart pair placement strategy
    for (const [num1, num2, difficulty] of pairs) {
      let bestPlacement = null;
      let bestScore = -1;

      // Try all possible placements and score them
      for (let row = 0; row < rows; row++) {
        for (let col1 = 0; col1 < cols; col1++) {
          if (!isPositionEmpty(grid, row, col1)) continue;

          // Try row placement
          for (let col2 = col1 + 1; col2 < cols; col2++) {
            if (!isPositionEmpty(grid, row, col2)) continue;
            if (hasValidPath(grid, row, col1, row, col2, filledCells)) {
              const score = scorePlacement(row, col1, row, col2, difficulty, difficultyConfig);
              if (score > bestScore) {
                bestScore = score;
                bestPlacement = { type: 'row', row, col1, col2 };
              }
            }
          }

          // Try column placement if appropriate
          for (let row2 = row + 1; row2 < rows; row2++) {
            if (!isPositionEmpty(grid, row2, col1)) continue;
            if (hasValidPath(grid, row, col1, row2, col1, filledCells)) {
              const score = scorePlacement(row, col1, row2, col1, difficulty, difficultyConfig);
              if (score > bestScore) {
                bestScore = score;
                bestPlacement = { type: 'col', row1: row, row2, col: col1 };
              }
            }
          }
        }
      }

      // Place the pair in the best position found
      if (bestPlacement) {
        if (bestPlacement.type === 'row') {
          grid[bestPlacement.row][bestPlacement.col1] = num1;
          grid[bestPlacement.row][bestPlacement.col2] = num2;
          filledCells.add(`${bestPlacement.row}-${bestPlacement.col1}`);
          filledCells.add(`${bestPlacement.row}-${bestPlacement.col2}`);
        } else {
          grid[bestPlacement.row1][bestPlacement.col] = num1;
          grid[bestPlacement.row2][bestPlacement.col] = num2;
          filledCells.add(`${bestPlacement.row1}-${bestPlacement.col}`);
          filledCells.add(`${bestPlacement.row2}-${bestPlacement.col}`);
        }
      } else {
        // If no valid placement found, fall back to simple pattern
        return generateSimpleGrid(currentStage);
      }
    }

    return grid;
  };

  // Helper function to score a potential pair placement
  const scorePlacement = (row1: number, col1: number, row2: number, col2: number, difficulty: number, config: any): number => {
    let score = 0;
    const distance = Math.abs(row1 - row2) + Math.abs(col1 - col2);
    
    // Prefer shorter distances in early stages, longer in later stages
    if (difficulty === 1) { // Easy pairs
      score += config.preferRowPlacement ? (10 - distance) : distance;
    } else { // Harder pairs
      score += config.preferRowPlacement ? distance : (10 - distance);
    }

    // Bonus for row placement in early stages
    if (row1 === row2 && config.preferRowPlacement) {
      score += 5;
    }

    // Penalty for exceeding max gap
    if (distance > config.maxGapBetweenPairs) {
      score -= 10;
    }

    return score;
  };

  // Generate a simple, guaranteed solvable grid
  const generateSimpleGrid = (currentStage: number): string[][] => {
    const rows = currentStage;
    const cols = 8;
    const grid: string[][] = Array(rows).fill(null).map(() => Array(cols).fill(''));
    const usedNumbers = new Set<number>();
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col += 2) {
        let num;
        if (Math.random() < 0.5) {
          // Equal pair
          do {
            num = Math.floor(Math.random() * 9) + 1;
          } while (usedNumbers.has(num));
          grid[row][col] = num.toString();
          grid[row][col + 1] = num.toString();
          usedNumbers.add(num);
        } else {
          // Sum to 10 pair
          do {
            num = Math.floor(Math.random() * 9) + 1;
          } while (usedNumbers.has(num) || usedNumbers.has(10 - num));
          grid[row][col] = num.toString();
          grid[row][col + 1] = (10 - num).toString();
          usedNumbers.add(num);
          usedNumbers.add(10 - num);
        }
      }
    }
    return grid;
  };

  // Initialize table data with generated grid
  const [tableData, setTableData] = useState<string[][]>(() => generateGrid(1));

  useEffect(() => {
    fetchTopPlayers();
  }, []);

  const fetchTopPlayers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/top-players');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setTopPlayers(data);
    } catch (error) {
      console.error('Error fetching top players:', error);
      setError('Failed to load top players. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // List of fun AI player names
  const aiNames = [
    "QuantumQuester", "ByteBrain", "NeuroPro", "LogicLeap", "DataDynamo",
    "SynapticSage", "AlgoAce", "CipherSolver", "MindMatrix", "PatternPro",
    "GridGuru", "MatchMaster", "NumberNinja", "PuzzlePro", "BrainBox",
    "CognitiveCracker", "IntelliPlay", "MemoryMaster", "SpeedSolver", "GridGenius"
  ];

  const getRandomAIName = () => {
    return aiNames[Math.floor(Math.random() * aiNames.length)];
  };

  const startLLMGames = async () => {
    setIsLLMPlaying(true);
    setError(null);
    const startTime = Date.now();
    let gamesCompleted = 0;
    const aiName = getRandomAIName();
    
    try {
      setError(`🤖 ${aiName} is starting to play...\nGame 1/20 - Level 1`);
      
      const response = await fetch('/api/llm-play', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playerName: aiName }) // Send AI name to backend
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      // Set up event source for progress updates
      const eventSource = new EventSource('/api/llm-play-progress');
      
      eventSource.onmessage = (event) => {
        const progress = JSON.parse(event.data);
        gamesCompleted = progress.gamesCompleted;
        const currentGame = progress.currentGame || gamesCompleted;
        const currentLevel = progress.currentLevel || 1;
        const matchesInLevel = progress.matchesInLevel || 0;
        
        setError(
          `🤖 ${aiName} is playing...\n` +
          `Game ${currentGame}/20 - Level ${currentLevel}\n` +
          `Matches found: ${matchesInLevel}/8\n` +
          `Games completed: ${gamesCompleted}\n` +
          `Time elapsed: ${((Date.now() - startTime) / 1000).toFixed(1)} seconds`
        );
      };
      
      const result = await response.json();
      eventSource.close();
      
      const totalTime = (Date.now() - startTime) / 1000;
      console.log('LLM games result:', result);
      
      setError(
        `✅ ${aiName} completed 20 games in ${totalTime.toFixed(1)} seconds!\n` +
        `🎯 Average score: ${(result.total_score / 20).toFixed(1)}\n` +
        `⏱️ Average time per game: ${result.average_time_per_game.toFixed(1)} seconds\n` +
        `🏆 High score: ${result.highest_score}`
      );
              
      await fetchTopPlayers();
    } catch (error: any) {
      console.error('Error starting LLM games:', error);
      setError(`❌ Error: ${aiName} encountered an issue - ${error.message}`);
    } finally {
      setIsLLMPlaying(false);
    }
  };

  // Check if two cells are in a straight line and have no unmatched cells between them
  const areCellsInClearLine = (row1: number, col1: number, row2: number, col2: number): boolean => {
    // Check if cells are in the same row
    if (row1 === row2) {
      const minCol = Math.min(col1, col2);
      const maxCol = Math.max(col1, col2);
      // Check all cells between them in the row
      for (let col = minCol + 1; col < maxCol; col++) {
        if (!matchedCells.has(`${row1}-${col}`)) {
          return false; // Found an unmatched cell between them
        }
      }
      return true;
    }
    
    // Check if cells are in the same column
    if (col1 === col2) {
      const minRow = Math.min(row1, row2);
      const maxRow = Math.max(row1, row2);
      // Check all cells between them in the column
      for (let row = minRow + 1; row < maxRow; row++) {
        if (!matchedCells.has(`${row}-${col1}`)) {
          return false; // Found an unmatched cell between them
        }
      }
      return true;
    }
    
    return false; // Cells are not in a straight line
  };

  const handleCellClick = (rowIdx: number, colIdx: number) => {
    if (levelCompleted || isLLMPlaying) return;
    const cellId = `${rowIdx}-${colIdx}`;

    if (matchedCells.has(cellId)) return;

    const currentValue = tableData[rowIdx][colIdx];
    
    if (!selectedCell) {
      setSelectedCell(cellId);
      setPrevCell(null);
    } else {
      const [prevRow, prevCol] = selectedCell.split('-').map(Number);
      const previousValue = tableData[prevRow][prevCol];

      if (selectedCell === cellId) {
        setSelectedCell(null);
        setPrevCell(null);
      } else if (
        (parseInt(currentValue) === parseInt(previousValue) || 
         parseInt(currentValue) + parseInt(previousValue) === 10) &&
        areCellsInClearLine(prevRow, prevCol, rowIdx, colIdx)
      ) {
        const newMatchedCells = new Set(matchedCells);
        newMatchedCells.add(selectedCell);
        newMatchedCells.add(cellId);
        setMatchedCells(newMatchedCells);
        setSelectedCell(null);
        setPrevCell(null);

        // Check if level is complete
        if (newMatchedCells.size === tableData.length * 8) {
          setLevelCompleted(true);
          const newScore = score + 100 * stage;
          setScore(newScore);

          // If all stages completed, submit score
          if (stage === maxStage) {
            if (playerName) {
              fetch('/api/save-score', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  name: playerName,
                  score: newScore,
                  date: new Date().toISOString()
                })
              }).then(() => fetchTopPlayers());
            }
          }
        }
      } else {
        setSelectedCell(null);
        setPrevCell(selectedCell);
      }
    }
  };

  const handleNextLevel = () => {
    if (levelCompleted && stage < maxStage) {
      const nextStage = stage + 1;
      setStage(nextStage);
      setTableData(generateGrid(nextStage));
      setLevelCompleted(false);
      setSelectedCell(null);
      setPrevCell(null);
      setMatchedCells(new Set());
    }
  };

  const handleResetGame = () => {
    setTableData(generateGrid(1));
    setStage(1);
    setScore(0);
    setLevelCompleted(false);
    setSelectedCell(null);
    setPrevCell(null);
    setMatchedCells(new Set());
    setPlayerName(""); // Reset player name too
    const name = prompt("Enter your name for the new game:");
    if (name) setPlayerName(name);
  };

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p style={{ color: 'red', whiteSpace: 'pre-line' }}>{error}</p>
        <button onClick={() => { setError(null); fetchTopPlayers(); }}>Retry</button>
      </div>
    );
  }

  return (
    <div className="game-container">
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>Stage {stage}</h2>
            <p style={{ margin: '10px 0' }}>Score: {score}</p>
          </div>
          <div>
            {!playerName && (
              <button onClick={() => {
                const name = prompt("Enter your name:");
                if (name) setPlayerName(name);
              }}>Set Name</button>
            )}
            <button 
              onClick={startLLMGames} 
              disabled={isLLMPlaying}
              style={{ marginLeft: '10px' }}
            >
              {isLLMPlaying ? 'LLM Playing...' : 'Let LLM Play'}
            </button>
            <button 
              onClick={handleResetGame}
              style={{ marginLeft: '10px' }}
            >
              Reset Game
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ flex: '1' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {tableData.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {row.map((cell, colIdx) => {
                      const cellId = `${rowIdx}-${colIdx}`;
                      const isMatched = matchedCells.has(cellId);
                      const isSelected = selectedCell === cellId;
                      const isPrevious = prevCell === cellId;
                      
                      return (
                        <td
                          key={cellId}
                          onClick={() => handleCellClick(rowIdx, colIdx)}
                          style={{
                            border: '1px solid #ccc',
                            width: '12.5%',
                            aspectRatio: '1',
                            cursor: isMatched ? 'default' : 'pointer',
                            background: isMatched ? '#90EE90' : 
                                      isSelected ? '#FFD700' :
                                      isPrevious ? '#FFA07A' : 'transparent',
                            transition: 'background-color 0.3s',
                            textAlign: 'center',
                            fontSize: '1.2em',
                            userSelect: 'none',
                            color: 'white'
                          }}
                        >
                          {isMatched ? '✓' : cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {levelCompleted && stage < maxStage && (
              <button 
                onClick={handleNextLevel}
                style={{ marginTop: '20px' }}
              >
                Next Level
              </button>
            )}
          </div>
          
          <div style={{ 
            width: '250px',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 15px 0' }}>Top Players</h3>
            {isLoading ? (
              <p>Loading...</p>
            ) : (
              <div>
                {topPlayers.map((player, index) => (
                  <div key={index} style={{ 
                    padding: '8px',
                    marginBottom: '8px',
                    background: 'white',
                    borderRadius: '4px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span>{player.name}</span>
                    <span>{player.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Table;