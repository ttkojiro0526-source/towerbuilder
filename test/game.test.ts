import assert from 'node:assert/strict'
import test from 'node:test'
import Matter from 'matter-js'
import { defaultTuning, randomPiece, shapes, type Piece } from '../src/config'
import { TowerGame, type Floor } from '../src/game'

const standard: Piece = { shape: 'standard', material: 'standard' }
const compact: Piece = { ...standard, shape: 'compact' }
const tall: Piece = { ...standard, shape: 'tall' }
const create = () => new TowerGame(defaultTuning(), () => 0.1)
function step(game: TowerGame, frames: number) {
  for (let frame = 0; frame < frames; frame++) game.step()
}

function stack(game: TowerGame, count: number) {
  const floors: Floor[] = []
  for (let index = 0; index < count; index++) {
    floors.push(game.createFloor(standard, 0, -20 - index * 40))
    step(game, 40)
  }
  assert.ok(floors.every(floor => floor.state.attached))
  return floors
}

test('a player can stack consecutive pendulum drops and the camera follows in world space', () => {
  const game = create()
  for (let drop = 0; drop < 8; drop++) {
    for (let frame = 0; frame < 300 && Math.abs(game.projectedX) >= 3; frame++) step(game, 1)
    assert.ok(Math.abs(game.projectedX) < 3)
    const { x, y, vx } = game.suspended
    assert.equal(game.drop(), true)
    assert.equal(game.drop(), false)
    const floor = [...game.floors.values()].at(-1)!
    assert.equal(floor.body.position.x, x)
    assert.equal(floor.body.position.y, y)
    assert.ok(Math.abs(floor.body.velocity.x - vx) < 1e-8)
    assert.equal(floor.state.attached, false)
    step(game, 103)
    assert.ok(floor.state.attached)
    assert.equal(floor.body.isStatic, false)
  }
  assert.ok(game.height >= 30)
  assert.ok(game.camera > 220)
  assert.ok(game.peak >= game.height)
  assert.equal(game.gameOver, false)
})

test('a tall floor can topple, settle sideways, and support another floor', () => {
  const game = create()
  const floor = game.createFloor(tall, 8, -50)
  Matter.Body.setAngle(floor.body, 0.15)
  Matter.Body.setAngularVelocity(floor.body, 0.08)
  step(game, 160)
  assert.ok(Math.abs(floor.body.angle - Math.PI / 2) < 0.12)
  assert.ok(floor.state.attached)
  const upper = game.createFloor(standard, floor.body.position.x, -74)
  step(game, 100)
  assert.ok(upper.state.attached)
  assert.ok(game.height >= 7.8)
  assert.equal(game.gameOver, false)
})

test('a standard floor can tip on the narrow edge of a compact floor', () => {
  const game = create()
  const base = game.createFloor(compact, 0, -20)
  step(game, 45)
  const upper = game.createFloor(standard, 33, -71)
  step(game, 100)
  assert.ok(base.state.attached)
  assert.ok(Math.abs(upper.body.angle) > 0.6)
  assert.equal(game.gameOver, false)
})

test('the pendulum can cast an unwanted floor outside the foundation without any collision', () => {
  const game = create()
  for (let n = 0; n < 240 && Math.abs(game.projectedX) < 138; n++) step(game, 1)
  assert.ok(Math.abs(game.projectedX) >= 138)
  assert.ok(game.drop())
  const launched = [...game.floors.values()][0]
  step(game, 175)
  assert.equal(launched.contacted, false)
  assert.equal(game.floors.size, 0)
  assert.equal(game.discarded, 1)
  assert.equal(game.peak, 0)
  assert.equal(game.chain.total, 0)
  assert.equal(game.gameOver, false)
  assert.ok(game.ready)
})

for (const count of [1, 2, 3]) {
  test(`a physical collapse of ${count} existing floors ${count === 3 ? 'ends the game' : 'allows play to continue'}`, () => {
    const game = create()
    const floors = stack(game, count)
    const priorPeak = game.peak
    Matter.Body.setVelocity(floors[0].body, { x: 35, y: 0 })
    step(game, 220)
    assert.equal(game.chain.total, count)
    assert.equal(game.gameOver, count === 3)
    assert.equal(game.drop(), count < 3)
    assert.ok(game.peak >= priorPeak)
    assert.equal(game.takeEvents().filter(event => event.kind === 'gameover').length, count === 3 ? 1 : 0)
  })
}

test('independent weights can select all nine shape and material combinations', () => {
  const shapeKeys = ['standardShape', 'tallShape', 'compactShape'] as const
  const materialKeys = ['standardMaterial', 'heavyMaterial', 'slickMaterial'] as const
  for (const [shapeIndex, shape] of (Object.keys(shapes) as Piece['shape'][]).entries()) {
    for (const [materialIndex, material] of (['standard', 'heavy', 'slick'] as const).entries()) {
      const settings = defaultTuning()
      for (const key of [...shapeKeys, ...materialKeys]) settings[key] = 0
      settings[shapeKeys[shapeIndex]] = 1
      settings[materialKeys[materialIndex]] = 1
      const piece = randomPiece(settings, 7, () => 0.78)
      assert.deepEqual(piece, { shape, material })
      const { body } = new TowerGame(settings).createFloor(piece, 0, -150)
      const density = material === 'heavy' ? settings.heavyDensity : settings.density
      assert.ok(Math.abs(body.density - density) < 1e-9)
      assert.equal(body.friction, material === 'slick' ? settings.slickFriction : settings.friction)
    }
  }
})
