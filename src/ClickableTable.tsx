import React, { useState } from 'react';
import './ClickableTable.css'; // We'll create this CSS file next

const ClickableTable = () => {
  // State to store the ID of the selected cell and previous cell
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [prevCell, setPrevCell] = useState<string | null>(null);
  const [levelCompleted, setLevelCompleted] = useState(false);

  // Function to handle a cell click
  // Keep track of matched cells
  const [matchedCells, setMatchedCells] = useState<Set<string>>(new Set());

  const handleCellClick = (rowIdx: number, colIdx: number) => {
    if (levelCompleted) return;
    const cellId = `${rowIdx}-${colIdx}`;
    
    // Don't allow clicking already matched cells
    if (matchedCells.has(cellId)) return;

    setSelectedCell((precellId) => {
      if (precellId) {
        const [pRow, pCol] = precellId.split('-').map(Number);
        const prevValue = tableData[pRow]?.[pCol];
        const currentValue = tableData[rowIdx]?.[colIdx];

        // If values match or sum to 10, add both cells to matched set
        if (prevValue && currentValue) {
          if (prevValue === currentValue || 
              Number(prevValue) + Number(currentValue) === 10) {
            const newMatchedCells = new Set(matchedCells);
            newMatchedCells.add(precellId);
            newMatchedCells.add(cellId);
            setMatchedCells(newMatchedCells);

            // Check if all cells in current stage are matched
            const totalCells = stage * 8; // stage rows × 8 columns
            if (newMatchedCells.size === totalCells) {
              // Auto advance to next stage
              if (stage < maxStage) {
                setTimeout(() => {
                  setStage(stage + 1);
                  setLevelCompleted(false);
                  setSelectedCell(null);
                  setPrevCell(null);
                  setMatchedCells(new Set());
                }, 1000); // Wait 1 second before advancing
              } else {
                setLevelCompleted(true);
              }
            }
          }
        }
      }
      setPrevCell(precellId);
      return cellId;
    });
  };

  // Handler to complete the level and re-enable all cells
  const handleCompleteLevel = () => {
    setLevelCompleted(true);
  };

  // Handler to reset the level (if needed)
  const handleResetLevel = () => {
    setLevelCompleted(false);
    setSelectedCell(null);
    setPrevCell(null);
  };

  // Generate stage data with increasing difficulty
  const generateStageData = (stage: number): string[][] => {
    const data: string[][] = [];
    for (let i = 0; i < stage; i++) {
      const row: string[] = [];
      for (let j = 0; j < 8; j++) {
        // As stages progress, include larger numbers and more pairs
        const maxNum = Math.min(9 + Math.floor(stage/2), 15);
        const num = Math.floor(Math.random() * maxNum) + 1;
        row.push(num.toString());
      }
      data.push(row);
    }
    return data;
  };

  // Data for the table - generate based on current stage
  const allRows = generateStageData(8);

  // Stage state: stage 1 = 1 row, stage 2 = 2 rows, ...
  const [stage, setStage] = useState(1);
  const maxStage = allRows.length;
  const tableData = allRows.slice(0, stage);

  return (
    <div className="table-container">
      <div style={{ width: '100%', maxWidth: 900, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0 }}>Stage {stage}</h2>
        </div>
        <div>
          <h4 style={{ margin: 0 }}>Score</h4>
        </div>
        <div>
          <h4 style={{ margin: 0 }}>Best Score</h4>
        </div>
      </div>
      <table>
        <tbody>
          {tableData.map((row, rowIdx) => {
            // Ensure each row has exactly 8 elements
            const fixedRow = row.slice(0, 8);
            while (fixedRow.length < 8) fixedRow.push("");
            return (
              <tr key={rowIdx}>
                {fixedRow.map((cell, colIdx) => {
                  const cellId = `${rowIdx}-${colIdx}`;
                  const isSelected = selectedCell === cellId;
                  const isPrev = prevCell === cellId;

                  // Get value of selected and previous cell
                  let selectedValue: string | null = null;
                  let prevValue: string | null = null;
                  if (selectedCell) {
                    const [sRow, sCol] = selectedCell.split('-').map(Number);
                    selectedValue = tableData[sRow]?.[sCol] ?? null;
                  }
                  if (prevCell) {
                    const [pRow, pCol] = prevCell.split('-').map(Number);
                    prevValue = tableData[pRow]?.[pCol] ?? null;
                  }

                  // Only disable the selected and previous cell if their values are equal or sum to 10
                  let isDisabled = false;
                  if (
                    selectedCell && prevCell &&
                    (selectedCell === cellId || prevCell === cellId)
                  ) {
                    if (
                      selectedValue !== null &&
                      prevValue !== null &&
                      (selectedValue === prevValue ||
                        Number(selectedValue) + Number(prevValue) === 10)
                    ) {
                      isDisabled = !levelCompleted;
                    }
                  }

                  return (
                    <td
                      key={cellId}
                      className={
                        (isSelected || isPrev ? 'selected ' : '') + (isDisabled ? 'disabled' : '')
                      }
                      onClick={
                        isDisabled ? undefined : () => handleCellClick(rowIdx, colIdx)
                      }
                      style={isDisabled ? { pointerEvents: 'none', cursor: 'not-allowed' } : {}}
                    >
                      {!matchedCells.has(cellId) ? cell : ''}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ marginTop: '1em' }}>
        <button onClick={handleCompleteLevel} disabled={levelCompleted}>
          Complete Level
        </button>
        <button onClick={handleResetLevel} style={{ marginLeft: '0.5em' }}>
          Reset Level
        </button>
        <button
          onClick={() => {
            if (stage < maxStage) {
              setStage(stage + 1);
              setLevelCompleted(false);
              setSelectedCell(null);
              setPrevCell(null);
            }
          }}
          style={{ marginLeft: '0.5em' }}
          disabled={!levelCompleted || stage >= maxStage}
        >
          Next Stage
        </button>
      </div>
    </div>
  );
};

export default ClickableTable;