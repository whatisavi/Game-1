import React, { useEffect, useRef, useState } from 'react'
import { animate } from 'motion'
import { createEmptyBoard, dropInColumn, findWinner, findWinningCells, getUpdatedScore, BoardState, Player, Scoreboard } from '../lib/game'

const COLUMNS = 7
const ROWS = 6

type GameProps = {
  user?: { id?: string; username?: string; email?: string; wins?: number }
}

export default function Game({ user }: GameProps) {
  const boardRef = useRef<HTMLDivElement | null>(null)
  const dropElementRef = useRef<HTMLDivElement | null>(null)
  const [board, setBoard] = useState<BoardState>(() => createEmptyBoard(ROWS, COLUMNS))
  const [current, setCurrent] = useState<Player>('R')
  const [winner, setWinner] = useState<Player | 'Draw' | null>(null)
  const [score, setScore] = useState<Scoreboard>({ R: 0, Y: 0, Draw: 0 })
  const [lastDrop, setLastDrop] = useState<{ col: number; row: number; player: Player } | null>(null)
  const [winningCells, setWinningCells] = useState<Array<{ row: number; col: number }>>([])
  const [lastDropSource, setLastDropSource] = useState<'user' | 'bot' | null>(null)
  const [pendingDrop, setPendingDrop] = useState<{ col: number; row: number; player: Player; nextBoard: BoardState } | null>(null)
  const meltOverlayRef = useRef<HTMLDivElement | null>(null)
  const laserRef = useRef<HTMLDivElement | null>(null)
  const moltenSvgRef = useRef<SVGSVGElement | null>(null)
  const moltenRef = useRef<SVGRectElement | null>(null)
  const cloneLayerRef = useRef<HTMLDivElement | null>(null)
  const popAudioRef = useRef<HTMLAudioElement | null>(null)
  const whooshAudioRef = useRef<HTMLAudioElement | null>(null)
  const [sfxVolume, setSfxVolume] = useState<number>(0.9)
  const [sfxMuted, setSfxMuted] = useState<boolean>(false)

  function handleDrop(col: number) {
    if (winner || current !== 'R' || pendingDrop) return

    const dropRow = board.findIndex((row) => row[col] === null)
    const next = dropInColumn(board, col, current)
    if (!next || dropRow === -1) return

    setPendingDrop({ col, row: dropRow, player: current, nextBoard: next })
  }

  useEffect(() => {
    // prepare click/pop audio - try same-origin first, then fall back to Vite dev server
    ;(async () => {
      try {
        const trySrc = async (src: string) => {
          try {
            const res = await fetch(src, { method: 'HEAD', cache: 'no-store' })
            return res && res.ok
          } catch {
            return false
          }
        }

        const local = '/pop.mp3'
        let srcToUse: string | null = null
        if (await trySrc(local)) {
          srcToUse = local
        } else if (await trySrc('http://127.0.0.1:5173/pop.mp3')) {
          srcToUse = 'http://127.0.0.1:5173/pop.mp3'
        }

        if (srcToUse) {
          const a = new Audio(srcToUse)
          a.preload = 'auto'
          a.volume = sfxMuted ? 0 : sfxVolume
          popAudioRef.current = a
        } else {
          popAudioRef.current = null
        }

        // try whoosh sound for molten bar
        const localWhoosh = '/whoosh.mp3'
        let whooshSrc: string | null = null
        if (await trySrc(localWhoosh)) {
          whooshSrc = localWhoosh
        } else if (await trySrc('http://127.0.0.1:5173/whoosh.mp3')) {
          whooshSrc = 'http://127.0.0.1:5173/whoosh.mp3'
        }
        if (whooshSrc) {
          const w = new Audio(whooshSrc)
          w.preload = 'auto'
          w.volume = sfxMuted ? 0 : Math.min(1, Math.max(0, sfxVolume))
          whooshAudioRef.current = w
        } else {
          whooshAudioRef.current = null
        }
      } catch {
        popAudioRef.current = null
      }
    })()

    if (!pendingDrop || !boardRef.current || !dropElementRef.current) return

    const boardElement = boardRef.current
    const targetCell = boardElement.querySelector<HTMLElement>(`[data-row="${pendingDrop.row}"][data-col="${pendingDrop.col}"]`)
    if (!targetCell) {
      setPendingDrop(null)
      return
    }

    const boardRect = boardElement.getBoundingClientRect()
    const targetRect = targetCell.getBoundingClientRect()
    const droplet = dropElementRef.current
    const startSize = 28
    const endSize = 46
    const startLeft = targetRect.left - boardRect.left + (targetRect.width - startSize) / 2
    const startTop = -startSize - 16
    const endLeft = targetRect.left - boardRect.left + (targetRect.width - endSize) / 2
    const endTop = targetRect.top - boardRect.top + (targetRect.height - endSize) / 2
    const startColor = pendingDrop.player === 'R' ? 'rgba(255, 82, 82, 0.9)' : 'rgba(255, 210, 77, 0.92)'
    const endColor = pendingDrop.player === 'R'
      ? 'radial-gradient(circle at 30% 30%, #ffb5b5 0%, #ff3b3b 52%, #c70000 100%)'
      : 'radial-gradient(circle at 30% 30%, #fff8b8 0%, #ffd845 52%, #d69d00 100%)'

    droplet.style.opacity = '1'
    droplet.style.left = `${startLeft}px`
    droplet.style.top = `${startTop}px`
    droplet.style.width = `${startSize}px`
    droplet.style.height = `${startSize}px`
    // start as a teardrop-ish shape (show 💧 emoji), then morph to a circle
    droplet.style.borderRadius = '50% 50% 50% 50% / 60% 60% 40% 40%'
    droplet.style.background = startColor
    // initial teardrop rotation + shape
    droplet.style.transform = 'rotate(18deg)'
    droplet.style.boxShadow = '0 24px 46px rgba(0, 0, 0, 0.16)'

    animate(droplet, {
      top: [`${startTop}px`, `${endTop}px`],
      left: [`${startLeft}px`, `${endLeft}px`],
      width: [`${startSize}px`, `${endSize}px`],
      height: [`${startSize}px`, `${endSize}px`],
      borderRadius: ['50% 50% 50% 50% / 70% 60% 40% 30%', '50%'],
      transform: ['rotate(18deg)', 'rotate(0deg)'],
      background: [startColor, endColor],
      boxShadow: ['0 24px 46px rgba(0, 0, 0, 0.16)', '0 0 22px rgba(0, 0, 0, 0.1)'],
    }, {
      duration: 0.55,
      easing: 'ease-out',
      onComplete: () => {
        // play pop sound for user drop
        try {
          const s = popAudioRef.current
          if (s) {
            s.currentTime = 0
            void s.play().catch(() => {})
          }
        } catch {}
        // clear emoji, hide overlay and commit board
        droplet.style.opacity = '0'
        droplet.textContent = ''
        setBoard(pendingDrop.nextBoard)
        setLastDrop({ col: pendingDrop.col, row: pendingDrop.row, player: pendingDrop.player })
        setLastDropSource('user')
        setPendingDrop(null)
        handlePostUserMove(pendingDrop.nextBoard)
      },
    })
    // ensure no stray text
    droplet.textContent = ''
  }, [pendingDrop])

  // Laser melt animation when a winner is set
  useEffect(() => {
    if (!winner || !boardRef.current || !meltOverlayRef.current || winningCells.length === 0) return

    const boardElement = boardRef.current
    const overlay = meltOverlayRef.current!
    const laser = laserRef.current!
    const moltenSvg = moltenSvgRef.current!
    const molten = moltenRef.current!

    // compute bounding box and exact centers for winning cells relative to board
    const boardRect = boardElement.getBoundingClientRect()
    const cellElements: HTMLElement[] = []
    for (const { row, col } of winningCells) {
      const el = boardElement.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`)
      if (el) cellElements.push(el)
    }
    if (cellElements.length === 0) return

    // compute centers and find the two farthest apart cells to determine angle and length
    const centers = cellElements.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.left - boardRect.left + r.width / 2, y: r.top - boardRect.top + r.height / 2, w: r.width, h: r.height }
    })

    let maxDist = -1
    let a = 0
    let b = 0
    for (let i = 0; i < centers.length; i++) {
      for (let j = i + 1; j < centers.length; j++) {
        const dx = centers[j].x - centers[i].x
        const dy = centers[j].y - centers[i].y
        const d2 = dx * dx + dy * dy
        if (d2 > maxDist) {
          maxDist = d2
          a = i
          b = j
        }
      }
    }

    const A = centers[a]
    const B = centers[b]
    const dx = B.x - A.x
    const dy = B.y - A.y
    const distance = Math.hypot(dx, dy)
    const ux = dx / distance
    const uy = dy / distance
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)

    // project each center onto the line direction and expand by token radius
    const projs = centers.map((c) => c.x * ux + c.y * uy)
    const tokenRadius = Math.max(...centers.map(c => Math.max(c.w, c.h))) / 2
    const lows = projs.map(p => p - tokenRadius)
    const highs = projs.map(p => p + tokenRadius)
    const minProj = Math.min(...lows)
    const maxProj = Math.max(...highs)
    const length = maxProj - minProj // span outer edges of tokens along the line

    // compute exact center point as midpoint between farthest cell centers (pixel coords)
    const centerX = (A.x + B.x) / 2
    const centerY = (A.y + B.y) / 2

    // position overlay to cover the whole board so clones can use board-local coords
    const minLeft = Math.min(...centers.map(c => c.x - c.w / 2))
    const minTop = Math.min(...centers.map(c => c.y - c.h / 2))
    const maxRight = Math.max(...centers.map(c => c.x + c.w / 2))
    const maxBottom = Math.max(...centers.map(c => c.y + c.h / 2))
    const width = maxRight - minLeft
    const height = maxBottom - minTop

    overlay.style.display = 'block'
    overlay.style.left = `0px`
    overlay.style.top = `0px`
    overlay.style.width = `${boardRect.width}px`
    overlay.style.height = `${boardRect.height}px`
    overlay.style.pointerEvents = 'none'

    // prepare laser and molten bar oriented along the line between farthest cells
    laser.style.opacity = '0'
    laser.style.width = `${length}px`
    laser.style.height = `6px`
    laser.style.left = `${centerX}px`
    laser.style.top = `${centerY}px`
    laser.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scaleX(0.08)`
    laser.style.transformOrigin = 'center center'
    laser.style.background = 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 45%, rgba(255,255,255,0.05) 70%, rgba(255,255,255,0) 100%)'
    laser.style.boxShadow = '0 0 18px rgba(255,255,255,0.9)'

    // position and size the SVG container; start a bit shorter then expand
    moltenSvg.style.opacity = '0'
    moltenSvg.style.width = `${length}px`
    moltenSvg.style.height = `28px`
    moltenSvg.style.left = `${centerX}px`
    moltenSvg.style.top = `${centerY}px`
    moltenSvg.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`
    moltenSvg.style.transformOrigin = 'center center'
    // configure rect: use percentage sizing inside SVG; set fill and filter
    molten.setAttribute('fill', winner === 'R' ? 'url(#moltenGradR)' : 'url(#moltenGradY)')
    molten.setAttribute('filter', 'url(#moltenGlow)')

    // animate laser in, sweep, melt pieces, then expand molten bar
    // step 1: flash beam
    animate(laser, { opacity: [0, 1, 0.95], transform: [`translate(-50%, -50%) rotate(${angle}deg) scaleX(0.08)`, `translate(-50%, -50%) rotate(${angle}deg) scaleX(1.02)`] }, { duration: 0.36, easing: 'ease-in' })

    // step 2: subtle shimmer across beam then melt
    setTimeout(() => {
      // instead of animating originals, clone each cell into overlay and animate clones
      const clones: HTMLElement[] = []
      const layer = cloneLayerRef.current ?? overlay
      for (const el of cellElements) {
        const r = el.getBoundingClientRect()
        const clone = el.cloneNode(true) as HTMLElement
        clone.style.position = 'absolute'
        clone.style.left = `${r.left - boardRect.left}px`
        clone.style.top = `${r.top - boardRect.top}px`
        clone.style.width = `${r.width}px`
        clone.style.height = `${r.height}px`
        clone.style.margin = '0'
        clone.style.transformOrigin = 'center center'
        clone.style.zIndex = '40'
        layer.appendChild(clone)
        clones.push(clone)
      }

      // animate clones to shrink and fade
      for (const clone of clones) {
        animate(clone, {
          transform: ['scale(1)', 'scale(0.6) translateY(6px)'],
          opacity: [1, 0],
          filter: ['none', 'brightness(1.6) saturate(1.4)']
        }, { duration: 0.65, easing: 'ease-in' })
      }

      // show molten bar (animate svg container opacity and then expand height)
      // play whoosh when the bar appears
      try {
        const w = whooshAudioRef.current
        if (w) {
          w.currentTime = 0
          void w.play().catch(() => {})
        }
      } catch {}
      animate(moltenSvg, { opacity: [0, 1] }, { duration: 0.35, easing: 'ease-out' })
      // expand the svg and rect to final height
      setTimeout(() => {
        moltenSvg.style.height = '44px'
        molten.setAttribute('height', '44')
        molten.setAttribute('rx', '22')
        molten.setAttribute('ry', '22')
      }, 160)

      // remove clones after animation
      setTimeout(() => {
        const layer = cloneLayerRef.current ?? overlay
        layer.innerHTML = ''
      }, 850)

      // small glow pulse (animate svg container shadow)
      setTimeout(() => {
        animate(moltenSvg, { boxShadow: ['0 22px 80px rgba(255,140,0,0.32)', '0 34px 120px rgba(255,140,0,0.44)'] }, { duration: 0.9, direction: 'alternate', repeat: 1 })
      }, 640)
    }, 220)

    // cleanup: leave molten for a bit, then hide overlay after delay
    const cleanupTimer = setTimeout(() => {
      animate(moltenSvg, { opacity: [1, 0.0] }, { duration: 0.6, easing: 'ease-in' })
      animate(laser, { opacity: [0.95, 0] }, { duration: 0.4 })
      setTimeout(() => {
        overlay.style.display = 'none'
        const layer = cloneLayerRef.current
        if (layer) layer.innerHTML = ''
      }, 500)
    }, 1500)

    return () => clearTimeout(cleanupTimer)
  }, [winner, winningCells])

  useEffect(() => {
    return () => {
      // nothing to cleanup for emoji timers any more
    }
  }, [])

  // Load saved SFX prefs and persist changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem('sfxVolume')
      if (raw !== null) {
        const v = Number(raw)
        if (!Number.isNaN(v)) setSfxVolume(v)
      }
      const muted = localStorage.getItem('sfxMuted')
      if (muted !== null) setSfxMuted(muted === '1')
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('sfxVolume', String(sfxVolume))
      localStorage.setItem('sfxMuted', sfxMuted ? '1' : '0')
    } catch {}
  }, [sfxVolume, sfxMuted])

  // apply effective volume to preloaded audio elements
  useEffect(() => {
    const effective = sfxMuted ? 0 : Math.min(1, Math.max(0, sfxVolume))
    try {
      if (popAudioRef.current) popAudioRef.current.volume = effective
    } catch {}
    try {
      if (whooshAudioRef.current) whooshAudioRef.current.volume = effective
    } catch {}
  }, [sfxVolume, sfxMuted])

  function handlePostUserMove(nextBoard: BoardState) {
    const w = findWinner(nextBoard)
    if (w) {
      setWinner(w)
      setWinningCells(findWinningCells(nextBoard)?.map(([row, col]) => ({ row, col })) ?? [])
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

      const botRow = nextBoard.findIndex((row) => row[botMove] === null)
      const botNext = dropInColumn(nextBoard, botMove, 'Y')
      if (!botNext || botRow === -1) {
        setWinner('Draw')
        setScore(prev => getUpdatedScore(prev, 'Draw'))
        return
      }

      setLastDrop({ col: botMove, row: botRow, player: 'Y' })
      setLastDropSource('bot')
      setBoard(botNext)
      // play pop sound for bot drop
      try {
        const s = popAudioRef.current
        if (s) {
          s.currentTime = 0
          void s.play().catch(() => {})
        }
      } catch {}
      const botWin = findWinner(botNext)
      if (botWin) {
        setWinner(botWin)
        setWinningCells(findWinningCells(botNext)?.map(([row, col]) => ({ row, col })) ?? [])
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
    return Array.from({ length: COLUMNS }, (_, index) => index).filter((col) => dropInColumn(currentBoard, col, 'R') !== null)
  }

  function isWinningMove(currentBoard: BoardState, col: number, player: Player): boolean {
    const next = dropInColumn(currentBoard, col, player)
    return next ? findWinner(next) === player : false
  }

  function scoreWindow(cells: (Player | null)[]): number {
    const myCount = cells.filter((cell) => cell === 'Y').length
    const yourCount = cells.filter((cell) => cell === 'R').length
    const emptyCount = cells.filter((cell) => cell === null).length

    if (myCount > 0 && yourCount > 0) return 0
    if (myCount === 4) return 10000
    if (myCount === 3 && emptyCount === 1) return 120
    if (myCount === 2 && emptyCount === 2) return 30
    if (myCount === 1 && emptyCount === 3) return 5

    if (yourCount === 4) return -10000
    if (yourCount === 3 && emptyCount === 1) return -140
    if (yourCount === 2 && emptyCount === 2) return -40
    if (yourCount === 1 && emptyCount === 3) return -7

    return 0
  }

  function evaluateBoard(currentBoard: BoardState): number {
    let score = 0

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLUMNS - 3; col += 1) {
        score += scoreWindow([
          currentBoard[row][col],
          currentBoard[row][col + 1],
          currentBoard[row][col + 2],
          currentBoard[row][col + 3],
        ])
      }
    }

    for (let col = 0; col < COLUMNS; col += 1) {
      for (let row = 0; row < ROWS - 3; row += 1) {
        score += scoreWindow([
          currentBoard[row][col],
          currentBoard[row + 1][col],
          currentBoard[row + 2][col],
          currentBoard[row + 3][col],
        ])
      }
    }

    for (let row = 0; row < ROWS - 3; row += 1) {
      for (let col = 0; col < COLUMNS - 3; col += 1) {
        score += scoreWindow([
          currentBoard[row][col],
          currentBoard[row + 1][col + 1],
          currentBoard[row + 2][col + 2],
          currentBoard[row + 3][col + 3],
        ])
      }
    }

    for (let row = 3; row < ROWS; row += 1) {
      for (let col = 0; col < COLUMNS - 3; col += 1) {
        score += scoreWindow([
          currentBoard[row][col],
          currentBoard[row - 1][col + 1],
          currentBoard[row - 2][col + 2],
          currentBoard[row - 3][col + 3],
        ])
      }
    }

    const centerCol = Math.floor(COLUMNS / 2)
    for (let row = 0; row < ROWS; row += 1) {
      if (currentBoard[row][centerCol] === 'Y') score += 8
      if (currentBoard[row][centerCol] === 'R') score -= 10
    }

    return score
  }

  function minimax(currentBoard: BoardState, depth: number, alpha: number, beta: number, maximizing: boolean): number {
    const winnerPlayer = findWinner(currentBoard)
    if (winnerPlayer === 'Y') return 100000
    if (winnerPlayer === 'R') return -100000

    const legalMoves = getLegalMoves(currentBoard)
    if (depth === 0 || legalMoves.length === 0) return evaluateBoard(currentBoard)

    if (maximizing) {
      let maxEval = -Infinity
      for (const col of legalMoves) {
        const next = dropInColumn(currentBoard, col, 'Y')
        if (!next) continue
        const evalScore = minimax(next, depth - 1, alpha, beta, false)
        maxEval = Math.max(maxEval, evalScore)
        alpha = Math.max(alpha, evalScore)
        if (beta <= alpha) break
      }
      return maxEval
    }

    let minEval = Infinity
    for (const col of legalMoves) {
      const next = dropInColumn(currentBoard, col, 'R')
      if (!next) continue
      const evalScore = minimax(next, depth - 1, alpha, beta, true)
      minEval = Math.min(minEval, evalScore)
      beta = Math.min(beta, evalScore)
      if (beta <= alpha) break
    }
    return minEval
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
      const score = minimax(nextBoard, 4, -Infinity, Infinity, false)
      return { col, score }
    })

    const highestScore = Math.max(...scoredMoves.map((move) => move.score))
    const bestMoves = scoredMoves.filter((move) => move.score >= highestScore - 50).map((move) => move.col)
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
    setLastDrop(null)
    setWinningCells([])
    setPendingDrop(null)
    setLastDropSource(null)
    // clear any overlay artifacts and inline styles on cells
    if (meltOverlayRef.current) {
      meltOverlayRef.current.style.display = 'none'
      const layer = cloneLayerRef.current
      if (layer) layer.innerHTML = ''
    }
    if (dropElementRef.current) {
      dropElementRef.current.style.opacity = '0'
    }
    const boardEl = boardRef.current
    if (boardEl) {
      const allCells = Array.from(boardEl.querySelectorAll<HTMLElement>('.cell'))
      for (const cell of allCells) {
        cell.style.opacity = ''
        cell.style.transform = ''
        cell.style.filter = ''
      }
    }
  }

  return (
    <div className="game">
      <div className="game-header">
        <div className="status">
          {winner ? (winner === 'Draw' ? 'Draw!' : `${winner} wins!`) : `Turn: ${current}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="sfx-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              aria-label={sfxMuted ? 'Unmute sound effects' : 'Mute sound effects'}
              onClick={() => setSfxMuted((v) => !v)}
              className="mute-btn"
              type="button"
            >
              {sfxMuted ? '🔇' : '🔊'}
            </button>
            <input
              aria-label="Sound effects volume"
              className="sfx-slider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sfxVolume}
              onChange={(e) => setSfxVolume(Number((e.target as HTMLInputElement).value))}
            />
          </div>
          <button className="restart-btn" onClick={reset}>Restart</button>
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
      <div className="board" role="grid" ref={boardRef}>
        {Array.from({ length: COLUMNS }).map((_, col) => (
          <div
            key={col}
            className="column"
            role="button"
            tabIndex={0}
            onClick={() => handleDrop(col)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleDrop(col)
              }
            }}
            aria-label={`Drop piece in column ${col + 1}`}
          >
            {Array.from({ length: ROWS }).map((_, rowIdx) => {
              const row = ROWS - 1 - rowIdx
              const cell = board[row][col]
              const isLastDrop = lastDrop?.col === col && lastDrop?.row === row
              const isWinningPiece = winningCells.some((win) => win.row === row && win.col === col)
              const dropDistance = ROWS - 1 - row
              const animateClass = isLastDrop && lastDropSource === 'bot' ? 'animate-drop' : ''
              return (
                <div
                  className={`cell ${cell || ''} ${animateClass} ${isWinningPiece ? 'win' : ''}`}
                  key={col + '-' + row}
                  style={animateClass ? { '--drop-distance': `${dropDistance * 56}px` } as React.CSSProperties : undefined}
                  data-row={row}
                  data-col={col}
                />
              )
            })}
          </div>
        ))}
        <div className="drop-overlay" ref={dropElementRef} />
        <div className="melt-overlay" ref={meltOverlayRef}>
          <div className="clone-layer" ref={cloneLayerRef} />
          <div className="laser" ref={laserRef} />
          <svg className="molten-bar" ref={moltenSvgRef} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 56" preserveAspectRatio="none">
            <defs>
              <linearGradient id="moltenGradR" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#fff5f5" stopOpacity="0.9" />
                <stop offset="45%" stopColor="#ff9b9b" stopOpacity="1" />
                <stop offset="100%" stopColor="#ff3b3b" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="moltenGradY" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#fffdf2" stopOpacity="0.95" />
                <stop offset="45%" stopColor="#ffe48a" stopOpacity="1" />
                <stop offset="100%" stopColor="#ffd845" stopOpacity="1" />
              </linearGradient>
              <filter id="moltenGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <rect ref={moltenRef} x="0" y="0" width="100%" height="100%" rx="9999" ry="9999" fill="url(#moltenGradR)" />
          </svg>
        </div>
      </div>
    </div>
  )
}
