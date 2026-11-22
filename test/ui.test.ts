import assert from 'node:assert/strict'
import test from 'node:test'
import { Window } from 'happy-dom'
import { readFile } from 'node:fs/promises'
import { build } from 'vite'
import { STEP_MS } from '../src/config'
import { TowerGame } from '../src/game'

test('the built UI handles both drop inputs, audio, collapse, restart and best-score persistence', async () => {
  const buildResult = await build({ logLevel: 'silent', build: { write: false } })
  assert.ok(!Array.isArray(buildResult) && 'output' in buildResult)
  const script = buildResult.output.find(item => item.type === 'chunk' && item.isEntry)
  assert.ok(script?.type === 'chunk')
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  const window = new Window({
    url: 'http://tower-builder.test/',
    settings: {
      enableJavaScriptEvaluation: true,
      disableJavaScriptFileLoading: true,
      // Only the bundle built from this checkout is evaluated.
      suppressInsecureJavaScriptEnvironmentWarning: true,
    },
  })
  try {
    let clock = 0
    let nextFrame: FrameRequestCallback | undefined
    let audioPlays = 0
    Object.defineProperty(window.performance, 'now', { value: () => clock })
    Object.defineProperty(window, 'requestAnimationFrame', {
      value: (callback: FrameRequestCallback) => {
        nextFrame = callback
        return 1
      },
    })
    const gradient = { addColorStop() {} }
    const context = new Proxy({}, {
      get: (_, name) => name === 'createLinearGradient' || name === 'createRadialGradient' ? () => gradient : () => {},
    })
    Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', { value: () => context })
    window.HTMLMediaElement.prototype.play = async () => { audioPlays++ }

    window.document.write(index.replace(/<script[^>]+><\/script>/, ''))
    window.document.close()
    window.eval('Math.random = () => 0.1')
    window.eval(script.code)

    const byId = (id: string) => {
      const value = window.document.getElementById(id)
      assert.ok(value instanceof window.HTMLElement)
      return value
    }
    const dialog = byId('settings')
    assert.ok(dialog instanceof window.HTMLDialogElement)
    const model = new TowerGame(undefined, () => 0.1)
    let accumulated = 0
    function frame() {
      const previous = clock
      clock += STEP_MS + 0.0001
      assert.ok(nextFrame)
      nextFrame(clock)
      if (!dialog.hasAttribute('open')) accumulated += clock - previous
      while (accumulated >= STEP_MS) {
        model.step()
        accumulated -= STEP_MS
      }
    }
    function aim(target = 0) {
      for (let i = 0; i < 400 && !(model.ready && Math.abs(model.projectedX - target) <= 3); i++) frame()
      assert.ok(model.ready && Math.abs(model.projectedX - target) <= 3)
    }

    assert.equal(byId('stage-status').textContent, '投下可能')
    aim()
    window.document.body.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Space', bubbles: true }))
    assert.ok(model.drop())
    assert.equal(byId('drops').textContent, '1')
    assert.equal(byId('stage-status').textContent, '補充中')
    assert.equal(audioPlays, 1)
    for (let i = 0; i < 105; i++) frame()
    assert.ok(Number(byId('height').textContent) >= 3.9)

    aim()
    byId('stage').click()
    assert.ok(model.drop())
    assert.equal(byId('drops').textContent, '2')
    for (let i = 0; i < 105; i++) frame()
    const saved = Number(window.localStorage.getItem('tower-builder.best-height'))
    assert.ok(saved >= 7.8)
    assert.equal(byId('best').textContent, saved.toFixed(1))

    byId('mute').click()
    assert.equal(byId('mute').getAttribute('aria-pressed'), 'true')
    assert.equal(window.localStorage.getItem('tower-builder.mute'), 'true')
    byId('open-settings').click()
    assert.ok(dialog.open)
    const volume = byId('volume')
    assert.ok(volume instanceof window.HTMLInputElement)
    volume.value = '25'
    volume.dispatchEvent(new window.Event('input'))
    assert.equal(byId('volume-value').textContent, '25%')
    assert.equal(window.localStorage.getItem('tower-builder.volume'), '25')
    dialog.close()
    assert.ok(!dialog.open)
    byId('mute').click()
    const audioBeforeCollapse = audioPlays

    for (let i = 0; i < 6; i++) {
      aim()
      byId('drop').click()
      assert.ok(model.drop())
      for (let wait = 0; wait < 105; wait++) frame()
    }
    for (let i = 0; i < 5 && !model.gameOver; i++) {
      aim(-25)
      byId('drop').click()
      assert.ok(model.drop())
      for (let wait = 0; wait < 130; wait++) frame()
    }
    assert.ok(model.gameOver)
    for (let i = 0; i < 60; i++) frame()
    assert.equal(byId('game-over').hidden, false)
    assert.equal(byId('chain').textContent, '3')
    assert.equal(byId('drop').getAttribute('aria-disabled'), 'true')
    assert.equal(byId('result-peak').textContent, model.peak.toFixed(1))
    assert.ok(audioPlays > audioBeforeCollapse + model.drops - 2)
    byId('restart').click()
    assert.equal(byId('game-over').hidden, true)
    assert.equal(byId('drops').textContent, '0')
    assert.equal(byId('height').textContent, '0.0')
    assert.equal(byId('stage-status').textContent, '投下可能')
    assert.equal(byId('best').textContent, model.peak.toFixed(1))
  } finally {
    await window.happyDOM.close()
  }
})
