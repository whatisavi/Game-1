import React, { useState } from 'react'
import { createEmptyBoard, dropInColumn, findWinner, getUpdatedScore, BoardState, Player, Scoreboard } from '../lib/game'

const COLUMNS = 7
const ROWS = 6

type GameProps = {
  user?: { id?: string; username?: string; email?: string; wins?: number }
}

export default function Game({ user }: GameProps) {
  const [board, setBoard] = useState<BoardState>(() => createEmptyBoard(ROWS, COLUMNS))
  const [current, setCurrent] = useState<Player>('R')
  const [winner, setWinner] = useState<Player | 'Draw' | null>(null)
  const [score, setScore] = useState<Scoreboard>({ R: 0, Y: 0, Draw: 0 })

  function handleDrop(col: number) {
    if (winner || current !== 'R') return

    const next = dropInColumn(board, col, current)
    if (!next) return

    const nextBoard = next
    setBoard(nextBoard)

    const w = findWinner(nextBoard)
    if (w) {
      setWinner(w)
      setScore(prev => getUpdatedScore(prev, w))
      if (w === 'R') {
        void reportWin()
      }
      return
    }

    if (!hasAvailableMoves(nextBoard)) {
      setWinner('Draw')
      setScore(prev => getUpdatedScore(prev, 'Draw'))
      return
    }

    setCurrent('Y')
    setTimeout(() => {
      const botMove = chooseBotMove(nextBoard)
      if (botMove === null) {
        setWinner('Draw')
        setScore(prev => getUpdatedScore(prev, 'Draw'))
        return
      }

      const botNext = dropInColumn(nextBoard, botMove, 'Y')
      if (!botNext) {
        setWinner('Draw')
        setScore(prev => getUpdatedScore(prev, 'Draw'))
        return
      }

      setBoard(botNext)
      const botWin = findWinner(botNext)
      if (botWin) {
        setWinner(botWin)
        setScore(prev => getUpdatedScore(prev, botWin))
        return
      }

      if (!hasAvailableMoves(botNext)) {
        setWinner('Draw')
        setScore(prev => getUpdatedScore(prev, 'Draw'))
        return
      }

      setCurrent('R')
    }, 350)
  }

  function hasAvailableMoves(currentBoard: BoardState): boolean {
    return Array.from({ length: COLUMNS }, (_, index) => index).some((col) => dropInColumn(currentBoard, col, 'R') !== null)
  }

  function chooseBotMove(currentBoard: BoardState): number | null {
    const candidateColumns = Array.from({ length: COLUMNS }, (_, index) => index).filter((col) => dropInColumn(currentBoard, col, 'R') !== null)
    if (candidateColumns.length === 0) return null

    const centerOrder = [3, 2, 4, 1, 5, 0, 6]
    const orderedColumns = centerOrder.filter((col) => candidateColumns.includes(col))

    const botWinningMove = orderedColumns.find((col) => {
      const next = dropInColumn(currentBoard, col, 'Y')
      return next ? findWinner(next) === 'Y' : false
    })
    if (botWinningMove !== undefined) return botWinningMove

    const playerWinningMove = orderedColumns.find((col) => {
      const next = dropInColumn(currentBoard, col, 'R')
      return next ? findWinner(next) === 'R' : false
    })
    if (playerWinningMove !== undefined) return playerWinningMove

    return orderedColumns[0] ?? candidateColumns[0] ?? null
  }

  async function reportWin() {
    try {
      await fetch('/api/game/win', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user?.username,
          email: user?.email,
          userId: user?.id,
        }),
      })
    } catch (error) {
      console.error('Failed to update win count', error)
    }
  }

  function reset() {
    setBoard(createEmptyBoard(ROWS, COLUMNS))
    setCurrent('R')
    setWinner(null)
  }

  return (
    <div className="game">
      <div className="game-header">
        <div className="status">
          {winner ? (winner === 'Draw' ? 'Draw!' : `${winner} wins!`) : `Turn: ${current}`}
        </div>
      </div>
      <div className="scoreboard" aria-label="Scoreboard">
        <div className="score-title">Score</div>
        <div className="score-pill red">
          <span className="score-label">Red</span>
          <strong>{score.R}</strong>
        </div>
        <div className="score-pill yellow">
          <span className="score-label">Yellow</span>
          <strong>{score.Y}</strong>
        </div>
        <div className="score-pill draw">
          <span className="score-label">Draws</span>
          <strong>{score.Draw}</strong>
        </div>
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
