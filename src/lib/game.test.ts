import { describe, it, expect } from 'vitest'
import { createEmptyBoard, dropInColumn, findWinner, BoardState } from './game'

describe('connect four game logic', () => {
  it('drops pieces into the lowest empty slot', () => {
    const b = createEmptyBoard(6, 7)
    const b1 = dropInColumn(b, 3, 'R')!
    expect(b1[0][3]).toBe('R')
    const b2 = dropInColumn(b1, 3, 'Y')!
    expect(b2[1][3]).toBe('Y')
  })

  it('detects horizontal win', () => {
    let b: BoardState = createEmptyBoard(6, 7)
    b = dropInColumn(b, 0, 'R')!
    b = dropInColumn(b, 1, 'R')!
    b = dropInColumn(b, 2, 'R')!
    b = dropInColumn(b, 3, 'R')!
    expect(findWinner(b)).toBe('R')
  })

  it('detects vertical win', () => {
    let b: BoardState = createEmptyBoard(6, 7)
    b = dropInColumn(b, 2, 'Y')!
    b = dropInColumn(b, 2, 'Y')!
    b = dropInColumn(b, 2, 'Y')!
    b = dropInColumn(b, 2, 'Y')!
    expect(findWinner(b)).toBe('Y')
  })
})
