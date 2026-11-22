import { GameAudio, readPreference, savePreference } from './audio'
import { defaultTuning, materials, shapes, STEP_MS, type Piece, type Tuning } from './config'
import { TowerGame } from './game'
import { Stage, drawBlock } from './render'
import './style.css'

function element<T extends HTMLElement = HTMLElement>(id: string) {
  const match = document.getElementById(id)
  if (!match) throw new Error(`Missing #${id}`)
  return match as T
}

const tuning = defaultTuning()
let game = new TowerGame(tuning)
const audio = new GameAudio()
const stageCanvas = element<HTMLCanvasElement>('stage')
const stage = new Stage(stageCanvas)
const stageStatus = element('stage-status')
const dropButton = element<HTMLButtonElement>('drop')
const dropLabel = element('drop-label')
const gameOver = element('game-over')
const restart = element<HTMLButtonElement>('restart')
const muteButton = element<HTMLButtonElement>('mute')
const muteLabel = element('mute-label')
const settings = element<HTMLDialogElement>('settings')
const volume = element<HTMLInputElement>('volume')
const volumeValue = element('volume-value')
const height = element('height')
const peak = element('peak')
const bestScore = element('best')
const resultPeak = element('result-peak')
const drops = element('drops')
const discarded = element('discarded')
const chain = element('chain')
const chainSegments = [...element('chain-meter').children]
const pieceName = element('piece-name')
const pieceMaterial = element('piece-material')
const pieceDescription = element('piece-description')
const preview = element<HTMLCanvasElement>('piece-image')
const previewContext = preview.getContext('2d')
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')
let best = Number(readPreference('tower-builder.best-height')) || 0
if (!Number.isFinite(best) || best < 0) best = 0
let previousPiece: Piece | undefined

function updateText(target: HTMLElement, text: string) {
  if (target.textContent !== text) target.textContent = text
}

function updateAudioControls() {
  muteButton.setAttribute('aria-pressed', String(audio.muted))
  muteButton.setAttribute('aria-label', audio.muted ? 'サウンドをオンにする' : 'サウンドをミュートする')
  muteLabel.textContent = audio.muted ? 'ミュート中' : 'サウンド'
  volume.value = String(audio.volume)
  volumeValue.textContent = `${audio.volume}%`
}

function updatePiece(piece: Piece) {
  if (piece === previousPiece) return
  previousPiece = piece
  const shape = shapes[piece.shape]
  pieceName.textContent = shape.label
  pieceMaterial.textContent = materials[piece.material].label
  pieceMaterial.dataset.material = piece.material
  pieceDescription.textContent = shape.description
  if (previewContext) {
    const scale = Math.min(1.45, 95 / Math.max(shape.width, shape.height))
    previewContext.setTransform(1, 0, 0, 1, 0, 0)
    previewContext.clearRect(0, 0, preview.width, preview.height)
    previewContext.setTransform(scale, 0, 0, scale, preview.width / 2, preview.height / 2)
    drawBlock(previewContext, piece, 0, 0)
  }
}

function updateUI() {
  const phase = game.gameOver ? 'over' : game.ready ? 'ready' : 'wait'
  if (stageStatus.dataset.state !== phase) {
    stageStatus.dataset.state = phase
    stageStatus.textContent = { ready: '投下可能', wait: '補充中', over: '建設終了' }[phase]
    dropLabel.textContent = { ready: 'ブロックを投下', wait: 'ブロック補充中', over: '建設終了' }[phase]
    dropButton.setAttribute('aria-disabled', String(phase !== 'ready'))
  }
  if (game.peak > best) {
    best = game.peak
    savePreference('tower-builder.best-height', String(best))
  }
  updateText(height, game.height.toFixed(1))
  updateText(peak, game.peak.toFixed(1))
  updateText(bestScore, best.toFixed(1))
  updateText(drops, String(game.drops))
  updateText(discarded, String(game.discarded))
  const lossCount = game.gameOver ? 3 : game.chain.count
  updateText(chain, String(lossCount))
  chainSegments.forEach((segment, index) => segment.toggleAttribute('data-active', index < lossCount))
  updatePiece(game.current)

  if (game.gameOver && gameOver.hidden && game.time - game.gameOverAt >= 850) {
    resultPeak.textContent = game.peak.toFixed(1)
    gameOver.hidden = false
    if (!settings.open && document.activeElement !== muteButton && document.activeElement !== element('open-settings')) {
      restart.focus({ preventScroll: true })
    }
  }
}

function tryDrop() {
  if (game.drop()) {
    audio.playDrop()
    updateUI()
  }
}

dropButton.addEventListener('click', tryDrop)
stageCanvas.addEventListener('click', tryDrop)
document.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.repeat || settings.open || event.altKey || event.ctrlKey || event.metaKey) return
  if (event.target instanceof Element && event.target.closest('button, input, summary, select, textarea, a, [contenteditable]')) return
  event.preventDefault()
  tryDrop()
})
restart.addEventListener('click', () => {
  audio.stop()
  game = new TowerGame(tuning)
  stage.clearEffects()
  gameOver.hidden = true
  updateUI()
  dropButton.focus({ preventScroll: true })
})
muteButton.addEventListener('click', () => {
  audio.setMuted(!audio.muted)
  updateAudioControls()
})
volume.addEventListener('input', () => {
  audio.setVolume(volume.valueAsNumber)
  updateAudioControls()
})
element('open-settings').addEventListener('click', () => settings.showModal())

type NumericTuning = Exclude<keyof Tuning, 'debugDraw'>
type Slider = [key: NumericTuning, name: string, min: number, max: number, step: number]
const groups: [string, Slider[]][] = [
  ['物理特性', [
    ['gravity', '重力', 0.2, 2.6, 0.01],
    ['density', '標準・低摩擦の密度', 0.0005, 0.005, 0.0001],
    ['heavyDensity', '重量の密度', 0.001, 0.01, 0.0001],
    ['friction', '標準・重量の摩擦係数', 0, 1, 0.01],
    ['slickFriction', '低摩擦の摩擦係数', 0, 1, 0.01],
    ['restitution', '反発係数', 0, 0.62, 0.01],
  ]],
  ['振り子', [
    ['ropeLength', 'ワイヤーの長さ', 90, 180, 1],
    ['amplitude', '振幅（度）', 15, 74, 1],
    ['period', '周期（秒）', 2.4, 7.5, 0.1],
  ]],
  ['出現の重み', [
    ['standardShape', '標準階', 0, 100, 1],
    ['tallShape', '縦長階', 0, 100, 1],
    ['compactShape', '小型階', 0, 100, 1],
    ['standardMaterial', '標準', 0, 100, 1],
    ['heavyMaterial', '重量', 0, 100, 1],
    ['slickMaterial', '低摩擦', 0, 100, 1],
  ]],
  ['崩壊・着地判定', [
    ['collapseDistance', '落下距離の閾値', 10, 75, 1],
    ['collapseGrace', '崩壊の猶予（ms）', 60, 850, 10],
    ['chainWindow', '連鎖の間隔（ms）', 300, 2700, 50],
    ['joinGrace', '組み込みの猶予（ms）', 80, 700, 10],
  ]],
]
const sliders: { key: NumericTuning; input: HTMLInputElement; output: HTMLOutputElement }[] = []
for (const [title, entries] of groups) {
  const group = document.createElement('fieldset')
  const legend = document.createElement('legend')
  legend.textContent = title
  group.append(legend)
  for (const [key, name, min, max, step] of entries) {
    const row = document.createElement('label')
    const caption = document.createElement('span')
    const output = document.createElement('output')
    const input = document.createElement('input')
    row.className = 'range-row'
    caption.textContent = name
    input.type = 'range'
    input.min = String(min)
    input.max = String(max)
    input.step = String(step)
    input.value = String(tuning[key])
    input.setAttribute('aria-label', name)
    output.value = input.value
    input.addEventListener('input', () => {
      tuning[key] = input.valueAsNumber
      output.value = input.value
    })
    row.append(caption, output, input)
    group.append(row)
    sliders.push({ key, input, output })
  }
  element('tuning-controls').append(group)
}
const debugDraw = element<HTMLInputElement>('debug-draw')
debugDraw.addEventListener('change', () => { tuning.debugDraw = debugDraw.checked })
element('reset-tuning').addEventListener('click', () => {
  Object.assign(tuning, defaultTuning())
  for (const { key, input, output } of sliders) output.value = input.value = String(tuning[key])
  debugDraw.checked = tuning.debugDraw
})

updateAudioControls()
updateUI()
let previousTime = performance.now()
let accumulator = 0
function frame(now: number) {
  const elapsed = Math.max(0, Math.min(now - previousTime, 100))
  previousTime = now
  // Pause while tuning so settings remain practical even during a precarious stack.
  if (!settings.open) accumulator += elapsed
  while (accumulator >= STEP_MS) {
    game.step()
    accumulator -= STEP_MS
  }
  for (const event of game.takeEvents()) {
    if (event.kind === 'impact') stage.impact(event.x, event.y, event.strength)
    if (event.kind === 'loss') stage.impact(event.x, event.y, 3 + event.count * 2, true)
    if (event.kind === 'gameover') audio.playCollapse()
  }
  updateUI()
  stage.paint(game, settings.open ? 0 : elapsed / 1000, reduceMotion.matches)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
