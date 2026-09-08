export type Player = 'R' | 'Y' | 'B'
export type Cell = Player | null
export type BoardState = Cell[][]
export type Scoreboard = Record<Player | 'Draw', number>

export function createEmptyBoard(rows: number, cols: number): BoardState {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null))
}

export function dropInColumn(board: BoardState, col: number, player: Player): BoardState | null {
  const rows = board.length
  const cols = board[0].length
  if (col < 0 || col >= cols) return null
  const newBoard = board.map(row => row.slice())
  for (let r = rows - 1; r >= 0; r--) {
    if (!newBoard[r][col]) {
      newBoard[r][col] = player
      return newBoard
    }
  }
  return null
}

function checkDirection(board: BoardState, startR: number, startC: number, dR: number, dC: number) {
  const player = board[startR][startC]
  if (!player) return 0
  let count = 0
  let r = startR
  let c = startC
  while (r >= 0 && r < board.length && c >= 0 && c < board[0].length && board[r][c] === player) {
    count++
    r += dR
    c += dC
  }
  return count
}

function collectDirection(board: BoardState, startR: number, startC: number, dR: number, dC: number) {
  const player = board[startR][startC]
  if (!player) return [] as [number, number][]
  const cells: [number, number][] = []
  let r = startR
  let c = startC
  while (r >= 0 && r < board.length && c >= 0 && c < board[0].length && board[r][c] === player) {
    cells.push([r, c])
    r += dR
    c += dC
  }
  return cells
}

export function findWinningCells(board: BoardState): [number, number][] | null {
  const rows = board.length
  const cols = board[0].length

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (!board[r][c]) continue
      const horizontal = collectDirection(board, r, c, 0, 1)
      if (horizontal.length >= 4) return horizontal
      const vertical = collectDirection(board, r, c, 1, 0)
      if (vertical.length >= 4) return vertical
      const diagDR = collectDirection(board, r, c, 1, 1)
      if (diagDR.length >= 4) return diagDR
      const diagUR = collectDirection(board, r, c, -1, 1)
      if (diagUR.length >= 4) return diagUR
    }
  }
  return null
}

export function findWinner(board: BoardState): Player | null {
  const rows = board.length
  const cols = board[0].length
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!board[r][c]) continue
      const p = board[r][c]
      // check horizontal
      if (checkDirection(board, r, c, 0, 1) >= 4) return p
      // check vertical
      if (checkDirection(board, r, c, 1, 0) >= 4) return p
      // diag down-right
      if (checkDirection(board, r, c, 1, 1) >= 4) return p
      // diag up-right
      if (checkDirection(board, r, c, -1, 1) >= 4) return p
    }
  }
  return null
}

export function getUpdatedScore(score: Scoreboard, result: Player | 'Draw'): Scoreboard {
  if (result === 'Draw') return score
  return {
    ...score,
    [result]: score[result] + 1,
  }
}

export function getDropRow(board: BoardState, col: number): number | undefined {
  const rows = board.length
  for (let row = rows - 1; row >= 0; row -= 1) {
    if (!board[row][col]) return row
  }
  return undefined
}

export function hasStealablePiece(board: BoardState): boolean {
  return board.some((row) => row.some((cell) => cell !== null && cell !== 'R'))
}

export function removePieceAndGravity(board: BoardState, row: number, col: number): BoardState {
  const nextBoard = board.map((currentRow) => currentRow.slice())
  if (row < 0 || row >= nextBoard.length || col < 0 || col >= nextBoard[0].length) {
    return nextBoard
  }

  if (nextBoard[row][col] === null) {
    return nextBoard
  }

  if (row === 0) {
    nextBoard[0][col] = null
    return nextBoard
  }

  for (let r = row - 1; r >= 0; r -= 1) {
    nextBoard[r + 1][col] = nextBoard[r][col]
  }
  nextBoard[0][col] = null

  return nextBoard
}
