import React, { useState, useEffect } from 'react';
import './ClickableTable.css';

interface Player {
  name: string;
  score: number;
  date: string;
}

const ClickableTable = () => {
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [prevCell, setPrevCell] = useState<string | null>(null);
  const [levelCompleted, setLevelCompleted] = useState(false);
  const [matchedCells, setMatchedCells] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState(1);
  const [score, setScore] = useState(0);
  const [playerName, setPlayerName] = useState("");
  const [topPlayers, setTopPlayers] = useState<Player[]>([]);
  const [isLLMPlaying, setIsLLMPlaying] = useState(false);
  const maxStage = 8;

  useEffect(() => {
    fetchTopPlayers();
  }, []);

  const fetchTopPlayers = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/top-players');
      const data = await response.json();
      setTopPlayers(data);
    } catch (error) {
      console.error('Error fetching top players:', error);
    }
  };

  const startLLMGames = async () => {
    setIsLLMPlaying(true);
    try {
      await fetch('http://localhost:8000/api/llm-play', {
        method: 'POST'
      });
      fetchTopPlayers(); // Refresh leaderboard after LLM games
    } catch (error) {
      console.error('Error starting LLM games:', error);
    }
    setIsLLMPlaying(false);
  };

  // Generate stage data with guaranteed matching pairs and increasing difficulty
  const generateRow = (currentStage: number): string[] => {
    const pairs: Array<[string, string]> = [];
    
    // As stage increases, prefer sum-to-10 pairs over equal pairs
    const equalPairProbability = Math.max(0.7 - (currentStage * 0.1), 0.2); // Decreases from 0.7 to 0.2
    
    for (let i = 0; i < 4; i++) {
      const pairType = Math.random() < equalPairProbability ? 'equal' : 'sum10';
      
      if (pairType === 'equal') {
        // For equal pairs, use larger numbers in later stages
        const minNum = Math.min(currentStage, 5); // Minimum number increases with stage
        const num = minNum + Math.floor(Math.random() * (9 - minNum + 1));
        pairs.push([num.toString(), num.toString()]);
      } else {
        // For sum-to-10 pairs, try to use numbers further apart in later stages
        let num1: number;
        if (currentStage <= 3) {
          // Early stages: prefer middle numbers (3-7)
          num1 = 3 + Math.floor(Math.random() * 5);
        } else {
          // Later stages: prefer extreme numbers (1-2 or 8-9)
          num1 = Math.random() < 0.5 ? 
                 1 + Math.floor(Math.random() * 2) : // 1 or 2
                 8 + Math.floor(Math.random() * 2);  // 8 or 9
        }
        const num2 = 10 - num1;
        pairs.push([num1.toString(), num2.toString()]);
      }
    }

    // Distribute pairs to ensure at least one solution path exists
    // Place pairs with some space between them for higher stages
    const result = new Array(8).fill('');
    pairs.forEach(([num1, num2]) => {
      // For higher stages, try to place pairs further apart
      const spacing = Math.min(2 + Math.floor(currentStage / 2), 4); // Increases with stage
      let pos1: number, pos2: number;
      
      do {
        pos1 = Math.floor(Math.random() * (8 - spacing));
        pos2 = pos1 + spacing;
      } while (result[pos1] !== '' || result[pos2] !== '');
      
      result[pos1] = num1;
      result[pos2] = num2;
    });

    // Fill any remaining empty spots
    const filledPositions = result.map((val, idx) => val !== '' ? idx : -1).filter(idx => idx !== -1);
    const emptyPositions = result.map((val, idx) => val === '' ? idx : -1).filter(idx => idx !== -1);
    
    emptyPositions.forEach(pos => {
      // Find the closest filled position
      const closestFilled = filledPositions.reduce((closest, filled) => 
        Math.abs(filled - pos) < Math.abs(closest - pos) ? filled : closest
      );
      const baseNum = parseInt(result[closestFilled]);
      // Place a number that can't form a pair with nearby numbers
      let newNum;
      do {
        newNum = 1 + Math.floor(Math.random() * 9);
      } while (newNum === baseNum || newNum === (10 - baseNum));
      result[pos] = newNum.toString();
    });

    return result;
  };

  // State for storing the row data
  const [tableData, setTableData] = useState<string[][]>(() => {
    return [generateRow(1)]; // Start with stage 1 difficulty
  });

  // Check if two cells are reachable (no unmatched cells between them)
  const areCellsReachable = (row1: number, col1: number, row2: number, col2: number): boolean => {
    // Same cell is not reachable
    if (row1 === row2 && col1 === col2) return false;

    // Check if cells are in the same row
    if (row1 === row2) {
      const minCol = Math.min(col1, col2);
      const maxCol = Math.max(col1, col2);
      // Check all cells between them
      for (let col = minCol + 1; col < maxCol; col++) {
        // If there's an unmatched cell between them, they're not reachable
        if (!matchedCells.has(`${row1}-${col}`)) {
          return false;
        }
      }
      return true;
    }

    // Check if cells are in the same column
    if (col1 === col2) {
      const minRow = Math.min(row1, row2);
      const maxRow = Math.max(row1, row2);
      // Check all cells between them
      for (let row = minRow + 1; row < maxRow; row++) {
        // If there's an unmatched cell between them, they're not reachable
        if (!matchedCells.has(`${row}-${col1}`)) {
          return false;
        }
      }
      return true;
    }

    // Not in same row or column
    return false;
  };

  const handleCellClick = (rowIdx: number, colIdx: number) => {
    if (levelCompleted || isLLMPlaying) return;
    const cellId = `${rowIdx}-${colIdx}`;

    // Don't allow clicking already matched cells
    if (matchedCells.has(cellId)) return;

    const currentValue = tableData[rowIdx][colIdx];
    
    // If this is the first click of a pair
    if (!selectedCell) {
      setSelectedCell(cellId);
      setPrevCell(null);
      return;
    }
    
    // This is the second click
    const [pRow, pCol] = selectedCell.split('-').map(Number);
    const prevValue = tableData[pRow][pCol];
    
    // If clicking the same cell, ignore it
    if (cellId === selectedCell) return;

    // Check if values match and cells are reachable
    if ((prevValue === currentValue || Number(prevValue) + Number(currentValue) === 10) && 
        areCellsReachable(pRow, pCol, rowIdx, colIdx)) {
      const newMatchedCells = new Set(matchedCells);
      newMatchedCells.add(selectedCell);
      newMatchedCells.add(cellId);
      setMatchedCells(newMatchedCells);
      setSelectedCell(null);
      setPrevCell(null);

      // Check if all cells in current stage are matched
      const stageTotal = tableData.reduce((sum, row) => sum + row.length, 0);
      if (newMatchedCells.size === stageTotal) {
        // Add score for completing the stage
        setScore(prevScore => prevScore + 100 * stage);

        // Auto advance to next stage
        if (stage < maxStage) {
          setTimeout(() => {
            setStage(s => s + 1);
            setLevelCompleted(false);
            setSelectedCell(null);
            setPrevCell(null);
            setMatchedCells(new Set());
            
            // Generate new data for the next stage
            setTableData(prevData => {
              const newData = [...prevData];
              newData.push(generateRow(stage + 1)); // Use next stage number for difficulty
              return newData;
            });
          }, 1000); // Wait 1 second before advancing
        } else {
          setLevelCompleted(true);
          // Save score if player name is entered
          if (playerName) {
            const player: Player = {
              name: playerName,
              score: score + 100 * stage, // Include final stage score
              date: new Date().toISOString()
            };
            fetch('http://localhost:8000/api/save-score', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(player)
            }).then(() => {
              fetchTopPlayers();
            });
          }
        }
      }
    } else {
      // No match - reset selection
      setSelectedCell(null);
      setPrevCell(selectedCell);
    }
  };

  // Handler to reset the level
  const handleResetLevel = () => {
    setLevelCompleted(false);
    setSelectedCell(null);
    setPrevCell(null);
    setMatchedCells(new Set());
    setStage(1);
    setScore(0);
    // Reset table data with one row
    setTableData([generateRow(1)]); // Reset with stage 1 difficulty
  };

  return (
    <div className="table-container">
      <div style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0 }}>Stage {stage}</h2>
          </div>
          <div>
            <h3 style={{ margin: 0 }}>Score: {score}</h3>
          </div>
          <div>
            <h4 style={{ margin: 0 }}>Matched Pairs: {matchedCells.size / 2}</h4>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            style={{ padding: '5px' }}
          />
          <button onClick={startLLMGames} disabled={isLLMPlaying}>
            {isLLMPlaying ? 'LLM is Playing...' : 'Start LLM Games'}
          </button>
          <button onClick={handleResetLevel}>Reset Level</button>
        </div>

        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ flex: '1' }}>
            <table>
              <tbody>
                {tableData.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {row.map((cell, colIdx) => {
                      const cellId = `${rowIdx}-${colIdx}`;
                      const isSelected = selectedCell === cellId;
                      const isPrev = prevCell === cellId;
                      const isMatched = matchedCells.has(cellId);

                      return (
                        <td
                          key={cellId}
                          className={`
                            ${isSelected || isPrev ? 'selected' : ''}
                            ${isMatched ? 'matched' : ''}
                          `}
                          onClick={!isMatched ? () => handleCellClick(rowIdx, colIdx) : undefined}
                        >
                          {cell}
                        </td>
                      );
                    })}
                    {[...Array(8 - row.length)].map((_, i) => (
                      <td key={`empty-${rowIdx}-${i}`}></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div style={{ flex: '0 0 300px', background: '#222', padding: '20px', borderRadius: '8px' }}>
            <h3 style={{ color: 'white', marginTop: 0 }}>Top Players</h3>
            <div style={{ color: 'white' }}>
              {topPlayers.map((player, index) => (
                <div key={index} style={{ 
                  padding: '8px', 
                  marginBottom: '4px', 
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>{index + 1}. {player.name}</span>
                  <span>{player.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClickableTable;