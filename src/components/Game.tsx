import React, { useEffect, useRef, useState } from 'react'
import { animate } from 'motion'
import { createEmptyBoard, dropInColumn, findWinner, findWinningCells, getUpdatedScore, removePieceAndGravity, getDropRow, hasStealablePiece, getWinnerForMode, BoardState, GameMode, Player, Scoreboard } from '../lib/game'

type GameProps = {
  user?: { id?: string; username?: string; email?: string; wins?: number }
  initialMode?: GameMode
  onBackHome?: () => void
}

const confettiPieces = Array.from({ length: 72 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  delay: `${(index % 8) * 0.06}s`,
  duration: `${2.1 + (index % 4) * 0.12}s`,
  color: ['#ff5252', '#ffd24d', '#38b2ac', '#4db8f2', '#ffffff'][index % 5],
  rotation: `${(index % 2 ? 1 : -1) * (18 + (index % 5) * 12)}deg`,
}))

type Difficulty = 'easy' | 'medium' | 'hard' | 'nightmare'

function getModeLabel(mode: GameMode): string {
  if (mode === 'anti-connect') return "Don't Connect Four"
  if (mode === 'triple') return 'Triple'
  if (mode === 'stealing') return 'Stealing'
  return 'Classic'
}

export default function Game({ user, initialMode = 'classic', onBackHome }: GameProps) {
  const [mode, setMode] = useState<GameMode>(initialMode)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [stealAvailable, setStealAvailable] = useState<boolean>(false)
  const [stealFlash, setStealFlash] = useState<boolean>(false)
  const [stealBannerText, setStealBannerText] = useState<string>('STEAL')
  const rows = mode === 'triple' ? 7 : 6
  const columns = mode === 'triple' ? 9 : 7
  const boardRef = useRef<HTMLDivElement | null>(null)
  const dropElementRef = useRef<HTMLDivElement | null>(null)
  const [board, setBoard] = useState<BoardState>(() => createEmptyBoard(rows, columns))
  const [current, setCurrent] = useState<Player>('R')
  const [winner, setWinner] = useState<Player | 'Draw' | null>(null)
  const [score, setScore] = useState<Scoreboard>({ R: 0, Y: 0, B: 0, Draw: 0 })
  const [lastDrop, setLastDrop] = useState<{ col: number; row: number; player: Player } | null>(null)
  const [winningCells, setWinningCells] = useState<Array<{ row: number; col: number }>>([])
  const [lastDropSource, setLastDropSource] = useState<'user' | 'bot' | null>(null)
  const [stealFallingCells, setStealFallingCells] = useState<Array<{ fromRow: number; toRow: number; col: number }>>([])
  const [pendingDrop, setPendingDrop] = useState<{ col: number; row: number; player: Player; nextBoard: BoardState; source: 'user' | 'bot' } | null>(null)
  const meltOverlayRef = useRef<HTMLDivElement | null>(null)
  const laserRef = useRef<HTMLDivElement | null>(null)
  const moltenSvgRef = useRef<SVGSVGElement | null>(null)
  const moltenRef = useRef<SVGRectElement | null>(null)
  const cloneLayerRef = useRef<HTMLDivElement | null>(null)
  const popAudioRef = useRef<HTMLAudioElement | null>(null)
  const whooshAudioRef = useRef<HTMLAudioElement | null>(null)
  const [sfxVolume, setSfxVolume] = useState<number>(0.9)
  const [sfxMuted, setSfxMuted] = useState<boolean>(false)
  const botMoveHistoryRef = useRef<Record<Player, number[]>>({ R: [], Y: [], B: [] })
  const openingCursorRef = useRef(0)
  const moveCountRef = useRef(0)

  function handleDrop(col: number) {
    if (winner || current !== 'R' || pendingDrop) return

    if (mode === 'stealing' && stealAvailable) {
      setStealAvailable(false)
      setStealFlash(false)
      setStealBannerText('STEAL')
    }

    const dropRow = getDropRow(board, col)
    const next = dropInColumn(board, col, current)
    if (!next || dropRow === undefined) return

    setPendingDrop({ col, row: dropRow, player: current, nextBoard: next, source: 'user' })
  }

  function handleCellClick(row: number, col: number) {
    if (mode === 'stealing' && stealAvailable) {
      handleSteal(row, col)
    }
  }

  function handleSteal(row: number, col: number) {
    if (winner || current !== 'R' || pendingDrop || mode !== 'stealing' || !stealAvailable) return

    const cell = board[row]?.[col]
    if (!cell || cell === 'R') return

    const movingCells = [] as Array<{ fromRow: number; toRow: number; col: number }>
    for (let r = row - 1; r >= 0; r -= 1) {
      if (board[r][col]) {
        movingCells.push({ fromRow: r, toRow: r + 1, col })
      }
    }

    const nextBoard = removePieceAndGravity(board, row, col)
    setBoard(nextBoard)
    setStealAvailable(false)
    setStealFlash(false)
    setStealBannerText('STEAL')
    setLastDrop(null)
    setLastDropSource(null)
    setStealFallingCells(movingCells)
    setCurrent('R')

    window.setTimeout(() => setStealFallingCells([]), 450)
  }

  function changeMode(nextMode: GameMode) {
    const nextRows = nextMode === 'triple' ? 7 : 6
    const nextCols = nextMode === 'triple' ? 9 : 7

    setMode(nextMode)
    setBoard(createEmptyBoard(nextRows, nextCols))
    setCurrent('R')
    setWinner(null)
    setScore({ R: 0, Y: 0, B: 0, Draw: 0 })
    setLastDrop(null)
    setWinningCells([])
    setPendingDrop(null)
    setLastDropSource(null)
    setStealAvailable(false)
    setStealFlash(false)
    setStealFallingCells([])
    moveCountRef.current = 0
    botMoveHistoryRef.current = { R: [], Y: [], B: [] }
  }

  useEffect(() => {
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
    const startColor = pendingDrop.player === 'R'
      ? 'rgba(255, 82, 82, 0.9)'
      : 'rgba(255, 210, 77, 0.92)'
    const endColor = pendingDrop.player === 'R'
      ? 'radial-gradient(circle at 30% 30%, #ffb5b5 0%, #ff3b3b 52%, #c70000 100%)'
      : 'radial-gradient(circle at 30% 30%, #fff8b8 0%, #ffd845 52%, #d69d00 100%)'

    droplet.style.opacity = '1'
    droplet.style.left = `${startLeft}px`
    droplet.style.top = `${startTop}px`
    droplet.style.width = `${startSize}px`
    droplet.style.height = `${startSize}px`
    droplet.style.borderRadius = '50% 50% 50% 50% / 60% 60% 40% 40%'
    droplet.style.background = startColor
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
        try {
          const s = popAudioRef.current
          if (s) {
            s.currentTime = 0
            void s.play().catch(() => {})
          }
        } catch {}
        droplet.style.opacity = '0'
        droplet.textContent = ''
        setBoard(pendingDrop.nextBoard)
        moveCountRef.current += 1
        setLastDrop({ col: pendingDrop.col, row: pendingDrop.row, player: pendingDrop.player })
        setLastDropSource(pendingDrop.source)
        setPendingDrop(null)
        if (pendingDrop.source === 'user') {
          handlePostUserMove(pendingDrop.nextBoard)
        } else {
          handleBotMoveOutcome(pendingDrop.nextBoard, pendingDrop.player)
        }
      },
    })
    droplet.textContent = ''
  }, [pendingDrop])

  useEffect(() => {
    if (!winner || !boardRef.current || !meltOverlayRef.current || winningCells.length === 0) return

    const boardElement = boardRef.current
    const overlay = meltOverlayRef.current!
    const laser = laserRef.current!
    const moltenSvg = moltenSvgRef.current!
    const molten = moltenRef.current!

    const boardRect = boardElement.getBoundingClientRect()
    const cellElements: HTMLElement[] = []
    for (const { row, col } of winningCells) {
      const el = boardElement.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`)
      if (el) cellElements.push(el)
    }
    if (cellElements.length === 0) return

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

    const projs = centers.map((c) => c.x * ux + c.y * uy)
    const tokenRadius = Math.max(...centers.map(c => Math.max(c.w, c.h))) / 2
    const lows = projs.map(p => p - tokenRadius)
    const highs = projs.map(p => p + tokenRadius)
    const minProj = Math.min(...lows)
    const maxProj = Math.max(...highs)
    const length = maxProj - minProj

    const centerX = (A.x + B.x) / 2
    const centerY = (A.y + B.y) / 2

    overlay.style.display = 'block'
    overlay.style.left = '0px'
    overlay.style.top = '0px'
    overlay.style.width = `${boardRect.width}px`
    overlay.style.height = `${boardRect.height}px`
    overlay.style.pointerEvents = 'none'

    laser.style.opacity = '0'
    laser.style.width = `${length}px`
    laser.style.height = '6px'
    laser.style.left = `${centerX}px`
    laser.style.top = `${centerY}px`
    laser.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scaleX(0.08)`
    laser.style.transformOrigin = 'center center'
    laser.style.background = 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 45%, rgba(255,255,255,0.05) 70%, rgba(255,255,255,0) 100%)'
    laser.style.boxShadow = '0 0 18px rgba(255,255,255,0.9)'

    moltenSvg.style.opacity = '0'
    moltenSvg.style.width = `${length}px`
    moltenSvg.style.height = '28px'
    moltenSvg.style.left = `${centerX}px`
    moltenSvg.style.top = `${centerY}px`
    moltenSvg.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`
    moltenSvg.style.transformOrigin = 'center center'
    molten.setAttribute('fill', winner === 'R' ? 'url(#moltenGradR)' : 'url(#moltenGradY)')
    molten.setAttribute('filter', 'url(#moltenGlow)')

    animate(laser, { opacity: [0, 1, 0.95], transform: [`translate(-50%, -50%) rotate(${angle}deg) scaleX(0.08)`, `translate(-50%, -50%) rotate(${angle}deg) scaleX(1.02)`] }, { duration: 0.36, easing: 'ease-in' })

    setTimeout(() => {
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

      for (const clone of clones) {
        animate(clone, {
          transform: ['scale(1)', 'scale(0.6) translateY(6px)'],
          opacity: [1, 0],
          filter: ['none', 'brightness(1.6) saturate(1.4)']
        }, { duration: 0.65, easing: 'ease-in' })
      }

      try {
        const w = whooshAudioRef.current
        if (w) {
          w.currentTime = 0
          void w.play().catch(() => {})
        }
      } catch {}
      animate(moltenSvg, { opacity: [0, 1] }, { duration: 0.35, easing: 'ease-out' })
      setTimeout(() => {
        moltenSvg.style.height = '44px'
        molten.setAttribute('height', '44')
        molten.setAttribute('rx', '22')
        molten.setAttribute('ry', '22')
      }, 160)

      setTimeout(() => {
        const layer = cloneLayerRef.current ?? overlay
        layer.innerHTML = ''
      }, 850)

      setTimeout(() => {
        animate(moltenSvg, { boxShadow: ['0 22px 80px rgba(255,140,0,0.32)', '0 34px 120px rgba(255,140,0,0.44)'] }, { duration: 0.9, direction: 'alternate', repeat: 1 })
      }, 640)
    }, 220)

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
    if (!stealFlash) return

    const timer = window.setTimeout(() => setStealFlash(false), 3000)
    return () => window.clearTimeout(timer)
  }, [stealFlash])

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
      const result = getWinnerForMode(w, mode)
      setWinner(result)
      setWinningCells(findWinningCells(nextBoard)?.map(([row, col]) => ({ row, col })) ?? [])
      setScore(prev => getUpdatedScore(prev, result))
      void reportGameResult(result === 'R' ? 'win' : 'loss')
      return
    }

    if (!hasAvailableMoves(nextBoard)) {
      setWinner('Draw')
      setScore(prev => getUpdatedScore(prev, 'Draw'))
      void reportGameResult('draw')
      return
    }

    if (mode === 'stealing' && moveCountRef.current >= 8 && hasStealablePiece(nextBoard)) {
      const canSteal = Math.random() < 0.18
      if (canSteal) {
        setLastDrop(null)
        setLastDropSource(null)
        setStealAvailable(true)
        setStealFlash(true)
        setStealBannerText('STEAL')
        setCurrent('R')
        return
      }
    }

    if (mode === 'triple') {
      setCurrent('Y')
      setTimeout(() => runTripleBot(nextBoard, 'Y'), 350)
      return
    }

    setCurrent('Y')
    setTimeout(() => {
      let botTurnBoard = nextBoard
      if (mode === 'stealing' && moveCountRef.current >= 8 && hasStealablePiece(nextBoard)) {
        const canBotSteal = Math.random() < 0.18
        if (canBotSteal) {
          const botStealCell = chooseBotStealCell(nextBoard, 'Y')
          if (botStealCell) {
            botTurnBoard = removePieceAndGravity(nextBoard, botStealCell.row, botStealCell.col)
            setBoard(botTurnBoard)
            setStealAvailable(false)
            setStealFlash(true)
            setStealBannerText("Bot's Turn to Steal")
            setLastDrop(null)
            setLastDropSource(null)
            setStealFallingCells([])
          }
        }
      }

      const botMove = chooseBotMove(botTurnBoard)
      if (botMove === null) {
        setWinner('Draw')
        setScore(prev => getUpdatedScore(prev, 'Draw'))
        void reportGameResult('draw')
        return
      }

      const botRow = getDropRow(botTurnBoard, botMove)
      const botNext = dropInColumn(botTurnBoard, botMove, 'Y')
      if (!botNext || botRow === undefined) {
        setWinner('Draw')
        setScore(prev => getUpdatedScore(prev, 'Draw'))
        void reportGameResult('draw')
        return
      }

      setBoard(botNext)
      moveCountRef.current += 1
      setLastDrop({ col: botMove, row: botRow, player: 'Y' })
      setLastDropSource('bot')
      try {
        const s = popAudioRef.current
        if (s) {
          s.currentTime = 0
          void s.play().catch(() => {})
        }
      } catch {}

      const botWin = findWinner(botNext)
      if (botWin) {
        const result = getWinnerForMode(botWin, mode)
        setWinner(result)
        setWinningCells(findWinningCells(botNext)?.map(([row, col]) => ({ row, col })) ?? [])
        setScore(prev => getUpdatedScore(prev, result))
        void reportGameResult(result === 'R' ? 'win' : 'loss')
        return
      }

      if (!hasAvailableMoves(botNext)) {
        setWinner('Draw')
        setScore(prev => getUpdatedScore(prev, 'Draw'))
        void reportGameResult('draw')
        return
      }

      setCurrent('R')
    }, 350)
  }

  function runTripleBot(currentBoard: BoardState, bot: Player) {
    const botMove = chooseTripleBotMove(currentBoard, bot)
    if (botMove === null) {
      setWinner('Draw')
      setScore(prev => getUpdatedScore(prev, 'Draw'))
      void reportGameResult('draw')
      return
    }

    const botRow = getDropRow(currentBoard, botMove)
    const botNext = dropInColumn(currentBoard, botMove, bot)
    if (!botNext || botRow === undefined) {
      setWinner('Draw')
      setScore(prev => getUpdatedScore(prev, 'Draw'))
      void reportGameResult('draw')
      return
    }

    setBoard(botNext)
    setLastDrop({ col: botMove, row: botRow, player: bot })
    setLastDropSource('bot')
    try {
      const sound = popAudioRef.current
      if (sound) {
        sound.currentTime = 0
        void sound.play().catch(() => {})
      }
    } catch {}

    const botWin = findWinner(botNext)
    if (botWin) {
      const result = getWinnerForMode(botWin, mode)
      setWinner(result)
      setWinningCells(findWinningCells(botNext)?.map(([row, col]) => ({ row, col })) ?? [])
      setScore(prev => getUpdatedScore(prev, result))
      void reportGameResult(result === 'R' ? 'win' : 'loss')
      return
    }

    if (!hasAvailableMoves(botNext)) {
      setWinner('Draw')
      setScore(prev => getUpdatedScore(prev, 'Draw'))
      void reportGameResult('draw')
      return
    }

    if (bot === 'Y') {
      setCurrent('B')
      setTimeout(() => runTripleBot(botNext, 'B'), 350)
    } else {
      setCurrent('R')
    }
  }

  function chooseBotStealCell(currentBoard: BoardState, bot: Player): { row: number; col: number } | null {
    const options: Array<{ row: number; col: number }> = []
    for (let row = 0; row < currentBoard.length; row += 1) {
      for (let col = 0; col < currentBoard[row].length; col += 1) {
        const cell = currentBoard[row][col]
        if (cell && cell !== bot) {
          options.push({ row, col })
        }
      }
    }

    if (options.length === 0) return null
    return options[Math.floor(Math.random() * options.length)]
  }

  function hasAvailableMoves(currentBoard: BoardState): boolean {
    return Array.from({ length: columns }, (_, index) => index).some((col) => dropInColumn(currentBoard, col, 'R') !== null)
  }

  function getLegalMoves(currentBoard: BoardState): number[] {
    return Array.from({ length: columns }, (_, index) => index).filter((col) => dropInColumn(currentBoard, col, 'R') !== null)
  }

  function isWinningMove(currentBoard: BoardState, col: number, player: Player): boolean {
    const next = dropInColumn(currentBoard, col, player)
    return next ? findWinner(next) === player : false
  }

  function chooseTripleBotMove(currentBoard: BoardState, bot: Player): number | null {
    const legalMoves = getLegalMoves(currentBoard)
    if (legalMoves.length === 0) return null

    if (difficulty === 'easy') {
      return rememberBotMove(bot, legalMoves[Math.floor(Math.random() * legalMoves.length)])
    }

    const opponents: Player[] = (['R', 'Y', 'B'] as Player[]).filter((player) => player !== bot)
    const winningMoves = getWinningMoves(currentBoard, bot)
    if (winningMoves.length > 0) return rememberBotMove(bot, chooseVariedColumn(winningMoves, bot))

    const opponentWinningMoves = new Set(opponents.flatMap((player) => getWinningMoves(currentBoard, player)))
    if (opponentWinningMoves.size === 1) {
      return rememberBotMove(bot, chooseVariedColumn([...opponentWinningMoves], bot))
    }
    if (botMoveHistoryRef.current[bot].length === 0) {
      return rememberBotMove(bot, chooseOpeningMove(currentBoard))
    }

    const scoredMoves = legalMoves.map((col) => {
      const nextBoard = dropInColumn(currentBoard, col, bot)!
      const blocksWin = opponentWinningMoves.has(col)
      const ownThreats = getWinningMoves(nextBoard, bot).length
      const opponentThreats = opponents.reduce((total, player) => total + getWinningMoves(nextBoard, player).length, 0)
      const centerDistance = Math.abs(Math.floor(columns / 2) - col)
      const score = evaluateTripleBoard(nextBoard, bot, opponents)
        + (blocksWin ? (difficulty === 'nightmare' ? 100000 : 50000) : 0)
        + ownThreats * (difficulty === 'nightmare' ? 7000 : 4000)
        - opponentThreats * (difficulty === 'nightmare' ? 10000 : 6500)
        - centerDistance * 12
      return { col, score }
    })

    return rememberBotMove(bot, chooseVariedScoredMove(scoredMoves, bot, difficulty === 'nightmare' ? 0.02 : difficulty === 'hard' ? 0.04 : 0.08))
  }

  function getWinningMoves(currentBoard: BoardState, player: Player): number[] {
    return getLegalMoves(currentBoard).filter((col) => isWinningMove(currentBoard, col, player))
  }

  function chooseVariedColumn(columnsToChoose: number[], bot: Player): number {
    const recentMoves = botMoveHistoryRef.current[bot]
    const freshMoves = columnsToChoose.filter((col) => !recentMoves.includes(col))
    const choices = freshMoves.length > 0 ? freshMoves : columnsToChoose
    return choices[Math.floor(Math.random() * choices.length)]
  }

  function chooseOpeningMove(currentBoard: BoardState): number {
    const legalMoves = getLegalMoves(currentBoard)
    const center = Math.floor(columns / 2)
    const centralMoves = legalMoves.filter((col) => Math.abs(col - center) <= 2)
    const choices = centralMoves.length > 0 ? centralMoves : legalMoves
    const selected = choices[openingCursorRef.current % choices.length]
    openingCursorRef.current += 1
    return selected
  }

  function chooseVariedScoredMove(scoredMoves: Array<{ col: number; score: number }>, bot: Player, variationPercent = 0.08): number {
    const highestScore = Math.max(...scoredMoves.map((move) => move.score))
    const variationWindow = Math.max(80, Math.abs(highestScore) * variationPercent)
    const recentMoves = botMoveHistoryRef.current[bot]
    const candidates = scoredMoves
      .filter((move) => move.score >= highestScore - variationWindow)
      .map((move) => ({
        ...move,
        adjustedScore: move.score - recentMoves.reduce((penalty, recentCol, index) => (
          penalty + (recentCol === move.col ? (index === recentMoves.length - 1 ? 180 : 90) : 0)
        ), 0) + Math.random() * variationWindow * 0.35,
      }))

    return candidates.reduce((best, move) => move.adjustedScore > best.adjustedScore ? move : best).col
  }

  function rememberBotMove(bot: Player, col: number): number {
    botMoveHistoryRef.current[bot] = [...botMoveHistoryRef.current[bot], col].slice(-3)
    return col
  }

  function scoreTripleWindow(cells: (Player | null)[], bot: Player, opponents: Player[]): number {
    const emptyCount = cells.filter((cell) => cell === null).length
    const botCount = cells.filter((cell) => cell === bot).length
    const opponentCount = Math.max(...opponents.map((player) => cells.filter((cell) => cell === player).length))

    if (botCount > 0 && opponentCount > 0) return 0
    if (botCount === 4) return 100000
    if (botCount === 3 && emptyCount === 1) return 1400
    if (botCount === 2 && emptyCount === 2) return 100
    if (opponentCount === 4) return -100000
    if (opponentCount === 3 && emptyCount === 1) return -1800
    if (opponentCount === 2 && emptyCount === 2) return -140
    return 0
  }

  function evaluateTripleBoard(currentBoard: BoardState, bot: Player, opponents: Player[]): number {
    let score = 0
    const addWindow = (cells: (Player | null)[]) => {
      score += scoreTripleWindow(cells, bot, opponents)
    }

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns - 3; col += 1) {
        addWindow([currentBoard[row][col], currentBoard[row][col + 1], currentBoard[row][col + 2], currentBoard[row][col + 3]])
      }
    }
    for (let col = 0; col < columns; col += 1) {
      for (let row = 0; row < rows - 3; row += 1) {
        addWindow([currentBoard[row][col], currentBoard[row + 1][col], currentBoard[row + 2][col], currentBoard[row + 3][col]])
      }
    }
    for (let row = 0; row < rows - 3; row += 1) {
      for (let col = 0; col < columns - 3; col += 1) {
        addWindow([currentBoard[row][col], currentBoard[row + 1][col + 1], currentBoard[row + 2][col + 2], currentBoard[row + 3][col + 3]])
      }
    }
    for (let row = 3; row < rows; row += 1) {
      for (let col = 0; col < columns - 3; col += 1) {
        addWindow([currentBoard[row][col], currentBoard[row - 1][col + 1], currentBoard[row - 2][col + 2], currentBoard[row - 3][col + 3]])
      }
    }

    const centerCol = Math.floor(columns / 2)
    for (let row = 0; row < rows; row += 1) {
      if (currentBoard[row][centerCol] === bot) score += 18
      if (opponents.includes(currentBoard[row][centerCol] as Player)) score -= 12
    }
    return score
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

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns - 3; col += 1) {
        score += scoreWindow([
          currentBoard[row][col],
          currentBoard[row][col + 1],
          currentBoard[row][col + 2],
          currentBoard[row][col + 3],
        ])
      }
    }

    for (let col = 0; col < columns; col += 1) {
      for (let row = 0; row < rows - 3; row += 1) {
        score += scoreWindow([
          currentBoard[row][col],
          currentBoard[row + 1][col],
          currentBoard[row + 2][col],
          currentBoard[row + 3][col],
        ])
      }
    }

    for (let row = 0; row < rows - 3; row += 1) {
      for (let col = 0; col < columns - 3; col += 1) {
        score += scoreWindow([
          currentBoard[row][col],
          currentBoard[row + 1][col + 1],
          currentBoard[row + 2][col + 2],
          currentBoard[row + 3][col + 3],
        ])
      }
    }

    for (let row = 3; row < rows; row += 1) {
      for (let col = 0; col < columns - 3; col += 1) {
        score += scoreWindow([
          currentBoard[row][col],
          currentBoard[row - 1][col + 1],
          currentBoard[row - 2][col + 2],
          currentBoard[row - 3][col + 3],
        ])
      }
    }

    const centerCol = Math.floor(columns / 2)
    for (let row = 0; row < rows; row += 1) {
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

    if (difficulty === 'easy') {
      return rememberBotMove('Y', legalMoves[Math.floor(Math.random() * legalMoves.length)])
    }

    if (mode === 'anti-connect') {
      const scoredMoves = legalMoves.map((col) => {
        const nextBoard = dropInColumn(currentBoard, col, 'Y')!
        const redThreats = getWinningMoves(nextBoard, 'R').length
        const yellowThreats = getWinningMoves(nextBoard, 'Y').length
        return { col, score: redThreats * 10000 - yellowThreats * 10000 }
      })

      return rememberBotMove('Y', chooseVariedScoredMove(scoredMoves, 'Y', 0.08))
    }

    const winningMoves = legalMoves.filter((col) => isWinningMove(currentBoard, col, 'Y'))
    if (winningMoves.length > 0) {
      return rememberBotMove('Y', chooseVariedColumn(winningMoves, 'Y'))
    }

    const blockingMoves = legalMoves.filter((col) => isWinningMove(currentBoard, col, 'R'))
    if (blockingMoves.length > 0) {
      return rememberBotMove('Y', chooseVariedColumn(blockingMoves, 'Y'))
    }
    if (botMoveHistoryRef.current.Y.length === 0) {
      return rememberBotMove('Y', chooseOpeningMove(currentBoard))
    }

    const scoredMoves = legalMoves.map((col) => {
      const nextBoard = dropInColumn(currentBoard, col, 'Y')!
      const depth = difficulty === 'nightmare' ? 7 : difficulty === 'hard' ? 5 : 3
      const score = minimax(nextBoard, depth, -Infinity, Infinity, false)
      return { col, score }
    })

    return rememberBotMove('Y', chooseVariedScoredMove(
      scoredMoves,
      'Y',
      difficulty === 'nightmare' ? 0.01 : difficulty === 'hard' ? 0.03 : 0.08,
    ))
  }

  async function reportGameResult(result: 'win' | 'loss' | 'draw') {
    try {
      await fetch('/api/game/win', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user?.username,
          email: user?.email,
          userId: user?.id,
          mode,
          result,
        }),
      })
    } catch (error) {
      console.error('Failed to update win count', error)
    }
  }

  function reset() {
    setBoard(createEmptyBoard(rows, columns))
    setCurrent('R')
    setWinner(null)
    setLastDrop(null)
    setWinningCells([])
    setPendingDrop(null)
    setLastDropSource(null)
    setStealAvailable(false)
    setStealFlash(false)
    setStealFallingCells([])
    moveCountRef.current = 0
    botMoveHistoryRef.current = { R: [], Y: [], B: [] }
    openingCursorRef.current = 0
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

  const resultOverlay = winner === 'R'
    ? 'win-overlay'
    : winner === 'Draw'
      ? 'draw-overlay'
      : winner
        ? 'loss-overlay'
        : null

  return (
    <div className={`game ${mode === 'triple' ? 'triple-mode' : ''}`}>
      {stealFlash && (
        <div className={`steal-banner ${stealBannerText === "Bot's Turn to Steal" ? 'bot-steal-banner' : ''}`} aria-live="assertive" role="status">
          {stealBannerText}
        </div>
      )}
      {resultOverlay && (
        <div className={`result-overlay ${resultOverlay}`} aria-live="assertive" role="status">
          {winner === 'R' && (
            <div className="confetti" aria-hidden="true">
              {confettiPieces.map((piece, index) => (
                <span
                  className="confetti-piece"
                  key={index}
                  style={{
                    left: piece.left,
                    animationDelay: piece.delay,
                    animationDuration: piece.duration,
                    backgroundColor: piece.color,
                    '--confetti-rotation': piece.rotation,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          )}
          {winner === 'R' && <strong className="result-message win-message">You win!</strong>}
          {winner !== 'R' && winner !== 'Draw' && <strong className="result-message loss-message">Dang you lost against a bot</strong>}
          {winner === 'Draw' && <strong className="result-message draw-message">=</strong>}
        </div>
      )}
      <div className="game-header">
        <div className="status">
          {winner ? (winner === 'Draw' ? 'Draw!' : `${winner === 'R' ? 'Red' : winner === 'Y' ? 'Yellow' : 'Blue'} wins!`) : `Turn: ${current === 'R' ? 'Red' : current === 'Y' ? 'Yellow' : 'Blue'}`}
        </div>
        <div className="game-header-actions">
          <span className="game-mode-badge">{getModeLabel(mode)}</span>
          <button className="back-home-btn" onClick={onBackHome}>Back to Homescreen</button>
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
        {mode === 'triple' && (
          <div className="score-pill blue">
            <span className="score-label">Blue</span>
            <strong>{score.B}</strong>
          </div>
        )}
        <div className="score-pill draw">
          <span className="score-label">Draws</span>
          <strong>{score.Draw}</strong>
        </div>
      </div>
      <div className="board" role="grid" ref={boardRef}>
        {Array.from({ length: columns }).map((_, col) => (
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
            {Array.from({ length: rows }).map((_, rowIdx) => {
              const row = rowIdx
              const cell = board[row][col]
              const isLastDrop = lastDrop?.col === col && lastDrop?.row === row
              const isWinningPiece = winningCells.some((win) => win.row === row && win.col === col)
              const isStealable = mode === 'stealing' && stealAvailable && !!board[row]?.[col] && board[row][col] !== 'R'
              const fallingCell = stealFallingCells.find((fall) => fall.toRow === row && fall.col === col)
              const isStealFall = Boolean(fallingCell)
              const dropDistance = row
              const animateClass = isLastDrop && lastDropSource === 'bot' ? 'animate-drop' : ''
              const cellStyle = isStealFall
                ? ({ '--drop-distance': `${Math.max(1, fallingCell!.toRow - fallingCell!.fromRow) * 56}px` } as React.CSSProperties)
                : animateClass
                  ? ({ '--drop-distance': `${dropDistance * 56}px` } as React.CSSProperties)
                  : undefined
              return (
                <div
                  className={`cell ${cell || ''} ${animateClass} ${isWinningPiece ? 'win' : ''} ${isStealable ? 'stealable' : ''} ${isStealFall ? 'steal-fall' : ''}`}
                  key={col + '-' + row}
                  style={cellStyle}
                  data-row={row}
                  data-col={col}
                  onClick={(event) => {
                    if (mode === 'stealing' && stealAvailable && isStealable) {
                      event.stopPropagation()
                      handleCellClick(row, col)
                    }
                  }}
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
                <stop offset="0%" stopColor="#ffb5b5"/>
                <stop offset="45%" stopColor="#ff3b3b"/>
                <stop offset="100%" stopColor="#c70000"/>
              </linearGradient>
              <linearGradient id="moltenGradY" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#fff8b8"/>
                <stop offset="45%" stopColor="#ffd845"/>
                <stop offset="100%" stopColor="#d69d00"/>
              </linearGradient>
              <linearGradient id="moltenGradB" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#dff5ff"/>
                <stop offset="45%" stopColor="#4db8f2"/>
                <stop offset="100%" stopColor="#0f7ecb"/>
              </linearGradient>
              <filter id="moltenGlow">
                <feGaussianBlur stdDeviation="1.5" result="blur"/>
                <feMerge>
                  <feMergeNode in="blur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <rect ref={moltenRef} x="0" y="0" width="100" height="28" rx="14" ry="14"/>
          </svg>
        </div>
      </div>
    </div>
  )
}
