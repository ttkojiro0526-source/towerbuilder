import assert from 'node:assert/strict'
import test from 'node:test'
import { CollapseChain, FloorState } from '../src/collapse'

const windowMs = 1250
const joinGrace = 210
const collapseGrace = 230
const threshold = 28
const stationary = { speed: 0, angularSpeed: 0 }

test('a chain counts distinct floors and includes losses exactly at the window boundary', () => {
  const chain = new CollapseChain(() => windowMs)
  assert.equal(chain.lose(10, 0), 1)
  assert.equal(chain.lose(10, 1000), 1)
  assert.equal(chain.lose(11, windowMs), 2)
  assert.equal(chain.lose(12, 2 * windowMs), 3)
  chain.expire(3 * windowMs + 1)
  assert.equal(chain.count, 0)
  assert.equal(chain.total, 3)
})

test('losses separated by more than the window are independent', () => {
  const chain = new CollapseChain(() => windowMs)
  assert.equal(chain.lose(5, 0), 1)
  assert.equal(chain.lose(6, windowMs + 1), 1)
  assert.equal(chain.lose(7, 2 * (windowMs + 1)), 1)
  assert.equal(chain.total, 3)
})

test('an airborne piece and a short impact remain outside the existing building', () => {
  const state = new FloorState()
  assert.equal(state.sample({ ...stationary, supported: false, y: 160 }, 550, joinGrace, collapseGrace, threshold), undefined)
  assert.equal(state.sample({ ...stationary, supported: true, y: 0 }, 80, joinGrace, collapseGrace, threshold), undefined)
  assert.equal(state.sample({ ...stationary, supported: false, y: 40 }, 250, joinGrace, collapseGrace, threshold), undefined)
  assert.equal(state.wasAttached, false)
})

test('a floor must lose support for long enough and drop at least the threshold', () => {
  const state = new FloorState()
  assert.equal(state.sample({ ...stationary, supported: true, y: -100 }, joinGrace, joinGrace, collapseGrace, threshold), 'joined')
  assert.equal(state.sample({ ...stationary, supported: false, y: -99 }, collapseGrace - 1, joinGrace, collapseGrace, threshold), undefined)
  assert.equal(state.sample({ ...stationary, supported: false, y: -100 + threshold - 1 }, 1, joinGrace, collapseGrace, threshold), undefined)
  assert.equal(state.sample({ ...stationary, supported: false, y: -100 + threshold }, 1, joinGrace, collapseGrace, threshold), 'lost')
  assert.equal(state.sample({ ...stationary, supported: false, y: -10 }, 1000, joinGrace, collapseGrace, threshold), undefined)
  assert.equal(state.wasAttached, true)
})

test('brief contact interruptions recover and reset the collapse grace', () => {
  const state = new FloorState()
  state.sample({ ...stationary, supported: true, y: -100 }, joinGrace, joinGrace, collapseGrace, threshold)
  state.sample({ ...stationary, supported: false, y: -96 }, 70, joinGrace, collapseGrace, threshold)
  state.sample({ ...stationary, supported: true, y: -98 }, joinGrace, joinGrace, collapseGrace, threshold)
  assert.equal(state.unsupportedFor, 0)
  assert.equal(state.sample({ ...stationary, supported: false, y: -69 }, 80, joinGrace, collapseGrace, threshold), undefined)
})
