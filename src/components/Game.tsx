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

  function getLegalMoves(currentBoard: BoardState): number[] {
    return Array.from({ length: COLUMNS }, (_, index) => index).filter((col) => dropInColumn(currentBoard, col, 'Y') !== null)
  }

  function isWinningMove(currentBoard: BoardState, col: number, player: Player): boolean {
    const next = dropInColumn(currentBoard, col, player)
    return next ? findWinner(next) === player : false
  }

  function evaluateBoard(currentBoard: BoardState): number {
    const scoreLine = (cells: (Player | null)[]): number => {
      const myCount = cells.filter((cell) => cell === 'Y').length
      const yourCount = cells.filter((cell) => cell === 'R').length
      const emptyCount = cells.filter((cell) => cell === null).length

      if (myCount > 0 && yourCount > 0) return 0
      if (myCount === 0 && yourCount === 0) return 0

      if (myCount > 0) {
        switch (myCount) {
          case 4:
            return 1000
          case 3:
            return emptyCount === 1 ? 80 : 30
          case 2:
            return emptyCount === 2 ? 12 : 6
          case 1:
            return 1
        }
      }

      switch (yourCount) {
        case 4:
          return -1000
        case 3:
          return emptyCount === 1 ? -80 : -28
        case 2:
          return emptyCount === 2 ? -10 : -4
        case 1:
          return -1
      }

      return 0
    }

    let score = 0
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLUMNS - 3; col += 1) {
        score += scoreLine([
          currentBoard[row][col],
          currentBoard[row][col + 1],
          currentBoard[row][col + 2],
          currentBoard[row][col + 3],
        ])
      }
    }

    for (let col = 0; col < COLUMNS; col += 1) {
      for (let row = 0; row < ROWS - 3; row += 1) {
        score += scoreLine([
          currentBoard[row][col],
          currentBoard[row + 1][col],
          currentBoard[row + 2][col],
          currentBoard[row + 3][col],
        ])
      }
    }

    for (let row = 0; row < ROWS - 3; row += 1) {
      for (let col = 0; col < COLUMNS - 3; col += 1) {
        score += scoreLine([
          currentBoard[row][col],
          currentBoard[row + 1][col + 1],
          currentBoard[row + 2][col + 2],
          currentBoard[row + 3][col + 3],
        ])
      }
    }

    for (let row = 3; row < ROWS; row += 1) {
      for (let col = 0; col < COLUMNS - 3; col += 1) {
        score += scoreLine([
          currentBoard[row][col],
          currentBoard[row - 1][col + 1],
          currentBoard[row - 2][col + 2],
          currentBoard[row - 3][col + 3],
        ])
      }
    }

    return score
  }

  function chooseBotMove(currentBoard: BoardState): number | null {
    const legalMoves = getLegalMoves(currentBoard)
    if (legalMoves.length === 0) return null

    const winningMoves = legalMoves.filter((col) => isWinningMove(currentBoard, col, 'Y'))
    if (winningMoves.length > 0) {
      return winningMoves[Math.floor(Math.random() * winningMoves.length)]
    }

    const blockingMoves = legalMoves.filter((col) => isWinningMove(currentBoard, col, 'R'))
    if (blockingMoves.length > 0) {
      return blockingMoves[Math.floor(Math.random() * blockingMoves.length)]
    }

    const scoredMoves = legalMoves.map((col) => {
      const nextBoard = dropInColumn(currentBoard, col, 'Y')!
      let score = evaluateBoard(nextBoard)
      score += 6 - Math.abs(col - 3) // prefer center columns slightly

      const opponentMoves = getLegalMoves(nextBoard)
      const opponentCanWin = opponentMoves.some((oppCol) => isWinningMove(nextBoard, oppCol, 'R'))
      if (opponentCanWin) score -= 280

      const unsafeMoves = opponentMoves.filter((oppCol) => isWinningMove(dropInColumn(nextBoard, oppCol, 'R') ?? nextBoard, oppCol, 'R'))
      if (unsafeMoves.length > 1) score -= 120

      return { col, score }
    })

    const highestScore = Math.max(...scoredMoves.map((move) => move.score))
    const bestMoves = scoredMoves.filter((move) => move.score >= highestScore - 8).map((move) => move.col)
    return bestMoves[Math.floor(Math.random() * bestMoves.length)]
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
