import { GROUND_SCREEN_Y, GROUND_WIDTH, HEIGHT, HEIGHT_UNIT, PIVOT_SCREEN_Y, shapes, WIDTH, type Piece } from './config'
import type { TowerGame } from './game'

const palette = {
  standard: { wall: '#e8b85c', top: '#ffdc87', edge: '#8d6438', glass: '#305568', light: '#8abeb8' },
  heavy: { wall: '#d87950', top: '#ffab72', edge: '#754938', glass: '#47364a', light: '#f9b594' },
  slick: { wall: '#69b8aa', top: '#a0e5d2', edge: '#38756f', glass: '#25495c', light: '#a6e3d5' },
}

function line(ctx: CanvasRenderingContext2D, x: number, y: number, x2: number, y2: number) {
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

export function drawBlock(ctx: CanvasRenderingContext2D, piece: Piece, x: number, y: number, angle = 0) {
  const { width, height } = shapes[piece.shape]
  const color = palette[piece.material]
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.translate(-width / 2, -height / 2)
  ctx.fillStyle = '#202b3b'
  ctx.fillRect(-1, -1, width + 2, height + 2)
  ctx.fillStyle = color.wall
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = color.edge
  ctx.fillRect(width - 6, 4, 6, height - 4)
  ctx.fillRect(0, height - 7, width, 7)
  ctx.fillStyle = color.top
  ctx.fillRect(0, 0, width, 5)
  ctx.fillRect(2, 7, 2, height - 16)

  const columns = piece.shape === 'standard' ? 4 : 2
  const rows = piece.shape === 'tall' ? 3 : 1
  const windowWidth = piece.shape === 'standard' ? 12 : 10
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const wx = 8 + (piece.shape === 'standard' ? 17 : 14) * column
      const wy = 10 + 21 * row
      ctx.fillStyle = color.top
      ctx.fillRect(wx - 1, wy + 15, windowWidth + 2, 2)
      ctx.fillStyle = color.glass
      ctx.fillRect(wx, wy, windowWidth, 15)
      ctx.fillStyle = color.light
      ctx.globalAlpha = 0.75
      ctx.fillRect(wx + 2, wy + 2, windowWidth - 4, 4)
      ctx.fillRect(wx + 2, wy + 6, 2, 4)
      ctx.globalAlpha = 1
    }
  }

  if (piece.material !== 'standard') {
    ctx.strokeStyle = color.top
    ctx.lineWidth = 1.5
    const y = height - 4
    for (let x = 6; x < width - 5; x += 7) {
      if (piece.material === 'heavy') line(ctx, x, y + 2, x + 3, y - 2)
      else line(ctx, x, y, x + 3, y)
    }
  }
  ctx.restore()
}

function noise(n: number) {
  const v = Math.sin(n * 91.173 + 17.65) * 45731.019
  return v - Math.floor(v)
}

type Building = { x: number; width: number; height: number; roof: number; seed: number }
function skyline(seed: number, count: number, width: number, minHeight: number, maxHeight: number) {
  const buildings: Building[] = []
  let x = -30
  for (let i = 0; i < count; i++) {
    const n = seed + i * 13
    const w = width * (0.65 + noise(n) * 0.65)
    buildings.push({ x, width: w, height: minHeight + noise(n + 1) * (maxHeight - minHeight), roof: noise(n + 2), seed: n })
    x += w + noise(n + 3) * 9
  }
  return buildings
}

const far = skyline(85, 37, 34, 28, 135)
const mid = skyline(315, 23, 50, 48, 174)
const near = skyline(707, 18, 61, 27, 149)

function drawSkyline(ctx: CanvasRenderingContext2D, buildings: Building[], y: number, color: string, glass: string, detail: boolean) {
  for (const { x, width, height, roof, seed } of buildings) {
    const top = y - height
    ctx.fillStyle = color
    ctx.fillRect(x, top, width, height + HEIGHT)
    if (roof > 0.25) ctx.fillRect(x + width * 0.16, top - 10 * roof, width * 0.65, 10 * roof)
    if (roof > 0.65) {
      ctx.fillRect(x + width * 0.45, top - 23 * roof, 1.2, 23 * roof)
      ctx.fillRect(x + width * 0.45 - 4, top - 17 * roof, 8, 1.2)
    }
    ctx.fillStyle = glass
    for (let wx = 6; wx < width - 6; wx += 9) {
      for (let wy = 8; wy < height + 25; wy += 11) {
        const chance = noise(seed + wx + wy * 13)
        if (chance > 0.52) {
          if (detail && chance > 0.91) {
            ctx.fillStyle = '#e7b77c'
            ctx.globalAlpha = 0.55
          }
          ctx.fillRect(x + wx, top + wy, detail ? 3 : 4, detail ? 4 : 3)
          ctx.globalAlpha = 1
          ctx.fillStyle = glass
        }
      }
    }
  }
}

const skylineBase = 206

function skylineLayer(buildings: Building[], color: string, windows: string, detail: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT + skylineBase
  const ctx = canvas.getContext('2d')
  if (ctx) drawSkyline(ctx, buildings, skylineBase, color, windows, detail)
  return canvas
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, alpha: number) {
  ctx.fillStyle = `rgba(255, 239, 219, ${alpha})`
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.quadraticCurveTo(x + width * 0.16, y - 7, x + width * 0.25, y - 5)
  ctx.quadraticCurveTo(x + width * 0.35, y - 31, x + width * 0.53, y - 13)
  ctx.quadraticCurveTo(x + width * 0.65, y - 20, x + width * 0.74, y - 7)
  ctx.quadraticCurveTo(x + width * 0.91, y - 6, x + width, y)
  ctx.closePath()
  ctx.fill()
  ctx.fillRect(x + width * 0.13, y + 5, width * 0.56, 1)
}

function drawBackground(ctx: CanvasRenderingContext2D, elevation: number, city: HTMLCanvasElement[]) {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  gradient.addColorStop(0, '#648bb2')
  gradient.addColorStop(0.42, '#91b1c5')
  gradient.addColorStop(0.74, '#d8bcc0')
  gradient.addColorStop(1, '#f6c391')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  const sunY = 194 + elevation * 0.065
  const glow = ctx.createRadialGradient(712, sunY, 33, 712, sunY, 153)
  glow.addColorStop(0, '#ffe8a460')
  glow.addColorStop(1, '#ffe8a400')
  ctx.fillStyle = glow
  ctx.fillRect(540, sunY - 154, 320, 312)
  ctx.fillStyle = '#ffe0a9'
  ctx.beginPath()
  ctx.arc(712, sunY, 47, 0, Math.PI * 2)
  ctx.fill()

  cloud(ctx, 31, 172 + elevation * 0.035, 172, 0.32)
  cloud(ctx, 195, 245 + elevation * 0.08, 114, 0.24)
  cloud(ctx, 486, 129 + elevation * 0.045, 153, 0.25)
  cloud(ctx, 667, 251 + elevation * 0.075, 210, 0.37)
  cloud(ctx, 585, 327 + elevation * 0.11, 136, 0.21)
  cloud(ctx, 13, 345 + elevation * 0.09, 177, 0.22)

  ctx.drawImage(city[0], 0, 465 + elevation * 0.20 - skylineBase)
  ctx.drawImage(city[1], 0, 526 + elevation * 0.35 - skylineBase)
  ctx.drawImage(city[2], 0, 589 + elevation * 0.62 - skylineBase)
  const bottom = ctx.createLinearGradient(0, 450, 0, HEIGHT)
  bottom.addColorStop(0, '#18253800')
  bottom.addColorStop(1, '#18253872')
  ctx.fillStyle = bottom
  ctx.fillRect(0, 450, WIDTH, HEIGHT - 450)
}

function drawCrane(ctx: CanvasRenderingContext2D, deckY: number, ready: boolean, load: TowerGame['suspended'], piece: Piece) {
  const x = WIDTH / 2
  const y = PIVOT_SCREEN_Y
  const tower = 124
  const beamLeft = 59
  const beamRight = x + 34
  const beamTop = y - 32

  ctx.fillStyle = '#263242'
  ctx.fillRect(tower - 1, y - 23, 32, Math.max(0, Math.min(HEIGHT + 5, deckY + 49) - y + 23))
  ctx.fillStyle = '#d29543'
  ctx.fillRect(tower + 2, y - 23, 26, Math.max(0, Math.min(HEIGHT + 5, deckY + 49) - y + 23))
  ctx.strokeStyle = '#695238'
  ctx.lineWidth = 4
  for (let n = y - 19; n < Math.min(HEIGHT, deckY + 30); n += 34) {
    line(ctx, tower + 4, n, tower + 25, n + 30)
    line(ctx, tower + 25, n, tower + 4, n + 30)
  }
  ctx.fillStyle = '#efb44d'
  ctx.fillRect(tower + 2, y - 12, 4, Math.max(0, Math.min(HEIGHT + 5, deckY + 49) - y + 12))
  ctx.fillRect(tower + 24, y - 12, 4, Math.max(0, Math.min(HEIGHT + 5, deckY + 49) - y + 12))

  ctx.lineWidth = 2
  ctx.strokeStyle = '#394654'
  line(ctx, tower + 15, 20, beamLeft + 5, beamTop)
  line(ctx, tower + 15, 20, beamRight - 10, beamTop)
  ctx.fillStyle = '#f3bd50'
  ctx.fillRect(tower + 12, 17, 6, 36)
  ctx.fillStyle = '#302e39'
  ctx.fillRect(beamLeft, beamTop - 2, beamRight - beamLeft, 22)
  ctx.fillStyle = '#c38b37'
  ctx.fillRect(beamLeft + 2, beamTop, beamRight - beamLeft - 4, 17)
  ctx.strokeStyle = '#684e35'
  ctx.lineWidth = 3
  for (let n = beamLeft + 3; n < beamRight - 17; n += 22) {
    line(ctx, n, beamTop + 1, n + 10, beamTop + 16)
    line(ctx, n + 10, beamTop + 16, n + 20, beamTop + 1)
  }
  ctx.fillStyle = '#fad06a'
  ctx.fillRect(beamLeft + 1, beamTop - 1, beamRight - beamLeft - 2, 4)
  ctx.fillRect(beamLeft + 1, beamTop + 16, beamRight - beamLeft - 2, 3)
  ctx.fillStyle = '#394053'
  ctx.fillRect(beamLeft + 1, beamTop + 21, 35, 12)
  ctx.fillRect(tower + 25, beamTop + 18, 33, 25)
  ctx.fillStyle = '#e7a94a'
  ctx.fillRect(tower + 27, beamTop + 20, 29, 20)
  ctx.fillStyle = '#354b60'
  ctx.fillRect(tower + 34, beamTop + 22, 19, 12)
  ctx.fillStyle = '#759bac'
  ctx.fillRect(tower + 36, beamTop + 24, 15, 3)

  ctx.fillStyle = '#353c48'
  ctx.fillRect(x - 13, y - 15, 26, 10)
  ctx.fillStyle = '#ffce66'
  ctx.fillRect(x - 9, y - 12, 18, 6)
  if (ready) {
    const end = load.y - shapes[piece.shape].height / 2
    ctx.lineWidth = 2
    ctx.strokeStyle = '#2e3c51'
    line(ctx, x, y, x + load.x, end)
    ctx.lineWidth = 1
    ctx.strokeStyle = '#f6e0a68a'
    line(ctx, x + 1.4, y, x + load.x + 1.4, end - 2)
    ctx.fillStyle = '#354154'
    ctx.fillRect(x + load.x - 5, end - 6, 10, 7)
    ctx.fillStyle = '#ffd477'
    ctx.fillRect(x + load.x - 3, end - 4, 6, 4)
  }
  ctx.fillStyle = '#3a404b'
  ctx.beginPath()
  ctx.arc(x, y, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f9c463'
  ctx.beginPath()
  ctx.arc(x, y, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawFoundation(ctx: CanvasRenderingContext2D, y: number) {
  if (y > HEIGHT + 2) return
  const left = WIDTH / 2 - GROUND_WIDTH / 2
  ctx.fillStyle = '#263348'
  ctx.fillRect(left + 14, y + 9, GROUND_WIDTH - 28, HEIGHT - y)
  ctx.fillStyle = '#39475b'
  ctx.fillRect(left + 16, y + 9, GROUND_WIDTH - 44, HEIGHT - y)
  ctx.fillStyle = '#4c5768'
  for (let x = left + 25; x < left + GROUND_WIDTH - 30; x += 21) ctx.fillRect(x, y + 25, 2, HEIGHT - y)
  ctx.fillStyle = '#263044'
  ctx.fillRect(left - 1, y - 1, GROUND_WIDTH + 2, 22)
  ctx.fillStyle = '#768092'
  ctx.fillRect(left, y, GROUND_WIDTH, 5)
  ctx.fillStyle = '#424758'
  ctx.fillRect(left, y + 5, GROUND_WIDTH, 13)
  ctx.save()
  ctx.beginPath()
  ctx.rect(left, y + 6, GROUND_WIDTH, 11)
  ctx.clip()
  ctx.fillStyle = '#d9a84e'
  for (let x = left - 16; x < left + GROUND_WIDTH + 12; x += 19) {
    ctx.beginPath()
    ctx.moveTo(x + 10, y + 5)
    ctx.lineTo(x + 19, y + 5)
    ctx.lineTo(x + 10, y + 18)
    ctx.lineTo(x, y + 18)
    ctx.fill()
  }
  ctx.restore()
  ctx.fillStyle = '#9ba1aa'
  ctx.fillRect(left - 1, y, GROUND_WIDTH + 2, 2)
}

function drawRuler(ctx: CanvasRenderingContext2D, offset: number) {
  ctx.strokeStyle = '#1e35484c'
  ctx.fillStyle = '#243b50'
  ctx.font = '600 10px ui-monospace, monospace'
  ctx.textAlign = 'left'
  ctx.lineWidth = 1
  const first = Math.max(0, Math.floor((offset - HEIGHT) / 50))
  for (let n = first, y = offset - first * 50; y >= 129; n++, y -= 50) {
    if (y > HEIGHT - 30) continue
    line(ctx, 27, y, n % 2 === 0 ? 43 : 35, y)
    if (n % 2 === 0) ctx.fillText(`${n * 5}m`, 48, y + 3)
  }
}

type Particle = { x: number; y: number; vx: number; vy: number; size: number; life: number; duration: number; color: string }

export class Stage {
  private ctx: CanvasRenderingContext2D
  private city = [
    skylineLayer(far, '#8c94ac', '#c3afbe', false),
    skylineLayer(mid, '#637a98', '#91a2b5', false),
    skylineLayer(near, '#425974', '#718399', true),
  ]
  private particles: Particle[] = []
  private shake = 0

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is unavailable')
    this.ctx = ctx
    this.resize()
    const observer = new ResizeObserver(() => this.resize())
    observer.observe(canvas)
  }

  clearEffects() {
    this.particles = []
    this.shake = 0
  }

  impact(x: number, y: number, strength: number, collapse = false) {
    this.shake = Math.max(this.shake, collapse ? strength : Math.min(4.5, strength * 0.22))
    const count = collapse ? 23 : Math.floor(Math.min(12, strength))
    for (let n = 0; n < count; n++) {
      const duration = 0.23 + Math.random() * (collapse ? 0.65 : 0.23)
      this.particles.push({
        x, y, vx: (Math.random() - 0.5) * (collapse ? 215 : 117),
        vy: -30 - Math.random() * (collapse ? 138 : 52), size: 2 + Math.random() * (collapse ? 5 : 3),
        life: duration, duration, color: ['#ffdc93', '#f8ac56', '#fff1c7', '#c77456'][n % 4],
      })
    }
  }

  private resize() {
    const scale = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.max(1, Math.round(this.canvas.clientWidth * scale))
    this.canvas.height = Math.max(1, Math.round(this.canvas.clientHeight * scale))
  }

  paint(game: TowerGame, dt: number, reducedMotion: boolean) {
    const { ctx, canvas } = this
    const stageScale = Math.min(canvas.width / WIDTH, canvas.height / HEIGHT)
    const padX = (canvas.width - WIDTH * stageScale) / 2
    const padY = (canvas.height - HEIGHT * stageScale) / 2
    ctx.setTransform(stageScale, 0, 0, stageScale, padX, padY)
    ctx.clearRect(-WIDTH, -HEIGHT, WIDTH * 3, HEIGHT * 3)

    const offset = GROUND_SCREEN_Y + game.camera
    drawBackground(ctx, game.camera, this.city)
    drawRuler(ctx, offset)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, WIDTH, HEIGHT)
    ctx.clip()
    if (!reducedMotion && this.shake > 0.05) {
      ctx.translate(Math.sin(game.time * 0.16) * this.shake, Math.cos(game.time * 0.19) * this.shake * 0.55)
    }
    this.shake *= Math.exp(-dt * 11)

    const load = game.suspended
    drawCrane(ctx, offset, game.ready, { ...load, y: load.y + offset }, game.current)
    drawFoundation(ctx, offset)
    if (game.ready) {
      const aim = WIDTH / 2 + game.projectedX
      const surface = offset - game.height * HEIGHT_UNIT
      const from = Math.min(surface - 40, Math.max(255, load.y + offset + 46))
      ctx.lineWidth = 1
      ctx.strokeStyle = '#fff0cdbc'
      ctx.setLineDash([3, 6])
      line(ctx, aim, from, aim, surface - 11)
      ctx.setLineDash([])
      ctx.strokeStyle = '#ffe2a0'
      line(ctx, aim - 8, surface - 7, aim + 8, surface - 7)
      line(ctx, aim, surface - 11, aim, surface - 3)
    }
    for (const { body, piece, state, supported } of game.floors.values()) {
      const x = WIDTH / 2 + body.position.x
      const y = offset + body.position.y
      if (y < -100 || y > HEIGHT + 110) continue
      drawBlock(ctx, piece, x, y, body.angle)
      if (game.tuning.debugDraw) {
        ctx.strokeStyle = supported ? '#aaff91' : '#ff7b7b'
        ctx.lineWidth = 1
        ctx.strokeRect(WIDTH / 2 + body.bounds.min.x, offset + body.bounds.min.y, body.bounds.max.x - body.bounds.min.x, body.bounds.max.y - body.bounds.min.y)
        ctx.fillStyle = '#fff'
        ctx.fillRect(x - 2, y - 2, 4, 4)
        line(ctx, x, y, x + body.velocity.x * 5, y + body.velocity.y * 5)
        ctx.font = '12px ui-monospace, monospace'
        const status = state.attached ? '組込' : state.everLost ? '崩落' : '未組込'
        ctx.fillText(`${status} ${body.speed.toFixed(1)}`, x + 7, y - 6)
      }
    }
    if (game.ready) drawBlock(ctx, game.current, WIDTH / 2 + load.x, offset + load.y)
    for (const p of this.particles) {
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 285 * dt
      ctx.globalAlpha = Math.max(0, p.life / p.duration)
      ctx.fillStyle = p.color
      ctx.fillRect(WIDTH / 2 + p.x, offset + p.y, p.size, p.size)
    }
    ctx.globalAlpha = 1
    this.particles = this.particles.filter(p => p.life > 0)
    ctx.restore()
  }
}
