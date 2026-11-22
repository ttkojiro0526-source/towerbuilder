import Matter from 'matter-js'
import { CollapseChain, FloorState } from './collapse'
import {
  defaultTuning, GROUND_SCREEN_Y, GROUND_WIDTH, HEIGHT_UNIT, PIVOT_SCREEN_Y,
  randomPiece, RELOAD_MS, shapes, STEP_MS, WIDTH,
  type Piece, type Tuning,
} from './config'

const { Bodies, Body, Composite, Engine, Events } = Matter
const airFriction = 0.014

export type Floor = {
  body: Matter.Body
  piece: Piece
  state: FloorState
  supported: boolean
  contacted: boolean
}

type GameEvent =
  | { kind: 'impact'; x: number; y: number; strength: number }
  | { kind: 'loss'; x: number; y: number; count: number }
  | { kind: 'gameover' }

export class TowerGame {
  engine = Engine.create({ enableSleeping: false, positionIterations: 10, velocityIterations: 8 })
  foundation = Bodies.rectangle(0, 23, GROUND_WIDTH, 46, {
    isStatic: true, friction: 1, frictionStatic: 1.3, label: 'foundation',
  })
  floors = new Map<number, Floor>()
  chain: CollapseChain
  time = 0
  phase = 1.18
  camera = 0
  height = 0
  peak = 0
  drops = 0
  discarded = 0
  gameOver = false
  gameOverAt = 0
  current: Piece
  readyAt = 0
  private events: GameEvent[] = []

  constructor(public tuning: Tuning = defaultTuning(), private random = Math.random) {
    this.chain = new CollapseChain(() => this.tuning.chainWindow)
    this.current = randomPiece(tuning, 0, random)
    Composite.add(this.engine.world, this.foundation)
    Events.on(this.engine, 'collisionStart', ({ pairs }) => {
      for (const { bodyA, bodyB, collision } of pairs) {
        for (const body of [bodyA, bodyB]) {
          const floor = this.floors.get(body.id)
          if (floor) floor.contacted = true
        }
        const strength = Math.abs(
          (bodyA.velocity.x - bodyB.velocity.x) * collision.normal.x
          + (bodyA.velocity.y - bodyB.velocity.y) * collision.normal.y,
        )
        if (strength >= 3) {
          const point = collision.supports[0]
          if (point) this.events.push({ kind: 'impact', x: point.x, y: point.y, strength })
        }
      }
    })
  }

  get ready() {
    return !this.gameOver && this.time >= this.readyAt
  }

  get pivot() {
    return PIVOT_SCREEN_Y - GROUND_SCREEN_Y - this.camera
  }

  get swingRate() {
    const difficulty = Math.min(1, this.peak / 110)
    return 2 * Math.PI / this.tuning.period * (1 + difficulty * 0.27)
  }

  get suspended() {
    const difficulty = Math.min(1, this.peak / 110)
    const amplitude = Math.min(1.46, this.tuning.amplitude * Math.PI / 180 * (1 + difficulty * 0.13))
    const angle = amplitude * Math.sin(this.phase)
    const angularSpeed = amplitude * Math.cos(this.phase) * this.swingRate
    const { height } = shapes[this.current.shape]
    const length = this.tuning.ropeLength
    return {
      x: length * Math.sin(angle),
      y: this.pivot + length * Math.cos(angle) + height / 2,
      vx: length * Math.cos(angle) * angularSpeed * STEP_MS / 1000,
    }
  }

  get projectedX() {
    const launch = this.suspended
    const surfaceY = -this.height * HEIGHT_UNIT
    const blockBottom = launch.y + shapes[this.current.shape].height / 2
    let x = launch.x
    let y = blockBottom
    let vx = launch.vx
    let vy = 0
    for (let step = 0; y < surfaceY && step < 180; step++) {
      vx *= 1 - airFriction
      vy = vy * (1 - airFriction) + this.tuning.gravity * 0.001 * STEP_MS ** 2
      x += vx
      y += vy
    }
    return x
  }

  createFloor(piece: Piece, x: number, y: number, velocity = 0): Floor {
    const { width, height } = shapes[piece.shape]
    const slick = piece.material === 'slick'
    const body = Bodies.rectangle(x, y, width, height, {
      label: piece.shape,
      density: piece.material === 'heavy' ? this.tuning.heavyDensity : this.tuning.density,
      friction: slick ? this.tuning.slickFriction : this.tuning.friction,
      frictionStatic: slick ? 0.28 : 1.25,
      restitution: this.tuning.restitution,
      frictionAir: airFriction,
      slop: 0.035,
    })
    Body.setVelocity(body, { x: velocity, y: 0 })
    const floor = { body, piece, state: new FloorState(), supported: false, contacted: false }
    this.floors.set(body.id, floor)
    Composite.add(this.engine.world, body)
    return floor
  }

  drop() {
    if (!this.ready) return false
    const { x, y, vx } = this.suspended
    this.createFloor(this.current, x, y, vx)
    this.drops++
    this.current = randomPiece(this.tuning, this.drops, this.random)
    this.readyAt = this.time + RELOAD_MS
    return true
  }

  step() {
    this.time += STEP_MS
    this.phase = (this.phase + this.swingRate * STEP_MS / 1000) % (2 * Math.PI)
    this.engine.gravity.y = this.tuning.gravity
    Engine.update(this.engine, STEP_MS)
    this.chain.expire(this.time)
    this.updateStructure()

    const target = Math.max(0, this.height * HEIGHT_UNIT - 66)
    const holdForAftermath = this.gameOver && this.time - this.gameOverAt < 480
    if (!holdForAftermath) {
      const smoothing = this.gameOver ? 0.033 : 0.085
      this.camera += (target - this.camera) * smoothing
    }
  }

  takeEvents() {
    const events = this.events
    this.events = []
    return events
  }

  private updateStructure() {
    // Matter's collision normal points from body B toward body A.
    const above = new Map<number, number[]>()
    for (const pair of this.engine.pairs.list) {
      if (!pair.isActive) continue
      const { bodyA, bodyB, normal } = pair.collision
      if (Math.abs(normal.y) < 0.32) continue
      const [lower, upper] = normal.y < 0 ? [bodyB, bodyA] : [bodyA, bodyB]
      if (upper === this.foundation || upper.position.y >= lower.position.y - 2) continue
      const list = above.get(lower.id) ?? []
      list.push(upper.id)
      above.set(lower.id, list)
    }

    const support = new Set<number>([this.foundation.id])
    const queue = [this.foundation.id]
    for (let i = 0; i < queue.length; i++) {
      for (const id of above.get(queue[i]) ?? []) {
        if (support.has(id)) continue
        support.add(id)
        queue.push(id)
      }
    }

    let top = 0
    for (const [id, floor] of this.floors) {
      const { body, state } = floor
      floor.supported = support.has(id)
      const result = state.sample({
        supported: floor.supported,
        y: body.position.y,
        speed: body.speed,
        angularSpeed: Math.abs(body.angularVelocity),
      }, STEP_MS, this.tuning.joinGrace, this.tuning.collapseGrace, this.tuning.collapseDistance)
      if (result === 'lost') this.registerLoss(floor)

      if (body.bounds.min.y > 226 || Math.abs(body.position.x) > WIDTH / 2 + 130) {
        if (state.attached) {
          state.detach()
          this.registerLoss(floor)
        }
        if (!state.wasAttached) this.discarded++
        this.floors.delete(id)
        Composite.remove(this.engine.world, body)
        continue
      }

      const brieflyUnsupported = state.unsupportedFor < 90 && body.position.y - state.referenceY < 10
      if (state.attached && (floor.supported || brieflyUnsupported)) {
        for (const vertex of body.vertices) top = Math.min(top, vertex.y)
      }
    }
    this.height = Math.max(0, Math.round(-top / HEIGHT_UNIT * 10) / 10)
    if (!this.gameOver) this.peak = Math.max(this.peak, this.height)
  }

  private registerLoss({ body }: Floor) {
    if (this.gameOver) return
    const count = this.chain.lose(body.id, this.time)
    this.events.push({ kind: 'loss', x: body.position.x, y: body.position.y, count })
    if (count >= 3) {
      this.gameOver = true
      this.gameOverAt = this.time
      this.events.push({ kind: 'gameover' })
    }
  }
}
