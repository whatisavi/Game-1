import React, { useState } from 'react'
import { createEmptyBoard, dropInColumn, findWinner, BoardState, Player } from '../lib/game'

const COLUMNS = 7
const ROWS = 6

export default function Game() {
  const [board, setBoard] = useState<BoardState>(() => createEmptyBoard(ROWS, COLUMNS))
  const [current, setCurrent] = useState<Player>('R')
  const [winner, setWinner] = useState<Player | 'Draw' | null>(null)

  function handleDrop(col: number) {
    if (winner) return
    const next = dropInColumn(board, col, current)
    if (!next) return
    setBoard(next)
    const w = findWinner(next)
    if (w) {
      setWinner(w)
    } else if (next.flat().every(Boolean)) {
      setWinner('Draw')
    } else {
      setCurrent(current === 'R' ? 'Y' : 'R')
    }
  }

  function reset() {
    setBoard(createEmptyBoard(ROWS, COLUMNS))
    setCurrent('R')
    setWinner(null)
  }

  return (
    <div className="game">
      <div className="status">
        {winner ? (winner === 'Draw' ? 'Draw!' : `${winner} wins!`) : `Turn: ${current}`}
      </div>
      <div className="board" role="grid">
        {Array.from({ length: COLUMNS }).map((_, col) => (
          <div key={col} className="column" role="column">
            <button className="drop" onClick={() => handleDrop(col)} aria-label={`Drop in ${col}`}>
              ↓
            </button>
            {Array.from({ length: ROWS }).map((_, rowIdx) => {
              const row = ROWS - 1 - rowIdx
              const cell = board[row][col]
              return <div className={`cell ${cell || ''}`} key={col + '-' + row} />
            })}
          </div>
        ))}
      </div>
      <div className="controls">
        <button onClick={reset}>Restart</button>
      </div>
    </div>
  )
}
