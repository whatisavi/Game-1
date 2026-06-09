export type Player = 'R' | 'Y'
export type Cell = Player | null
export type BoardState = Cell[][]

export function createEmptyBoard(rows: number, cols: number): BoardState {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null))
}

export function dropInColumn(board: BoardState, col: number, player: Player): BoardState | null {
  const rows = board.length
  const cols = board[0].length
  if (col < 0 || col >= cols) return null
  const newBoard = board.map(row => row.slice())
  for (let r = 0; r < rows; r++) {
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
