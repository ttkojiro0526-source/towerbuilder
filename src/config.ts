export const WIDTH = 880
export const HEIGHT = 610
export const GROUND_SCREEN_Y = 493
export const GROUND_WIDTH = 188
export const PIVOT_SCREEN_Y = 78
export const STEP_MS = 1000 / 60
export const HEIGHT_UNIT = 10
export const RELOAD_MS = 720

export const shapes = {
  standard: { label: '標準階', description: '幅広で安定しやすい', width: 80, height: 40, weight: 64 },
  tall: { label: '縦長階', description: '高さを稼げるが倒れやすい', width: 40, height: 80, weight: 20 },
  compact: { label: '小型階', description: '次の階の足場が狭くなる', width: 40, height: 40, weight: 16 },
} as const

export const materials = {
  standard: { label: '標準', weight: 72 },
  heavy: { label: '重量', weight: 17 },
  slick: { label: '低摩擦', weight: 11 },
} as const

export type Shape = keyof typeof shapes
export type Material = keyof typeof materials
export type Piece = { shape: Shape; material: Material }

export function defaultTuning() {
  return {
    gravity: 1.05,
    density: 0.0013,
    heavyDensity: 0.0035,
    friction: 0.79,
    slickFriction: 0.10,
    restitution: 0.04,
    ropeLength: 128,
    amplitude: 53,
    period: 3.9,
    standardShape: shapes.standard.weight as number,
    tallShape: shapes.tall.weight as number,
    compactShape: shapes.compact.weight as number,
    standardMaterial: materials.standard.weight as number,
    heavyMaterial: materials.heavy.weight as number,
    slickMaterial: materials.slick.weight as number,
    collapseDistance: 28,
    collapseGrace: 230,
    chainWindow: 1250,
    joinGrace: 210,
    debugDraw: false,
  }
}

export type Tuning = ReturnType<typeof defaultTuning>

function weighted<T>(entries: ReadonlyArray<readonly [T, number]>, fallback: T, random: () => number): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  let ticket = random() * total
  for (const [value, weight] of entries) {
    ticket -= weight
    if (ticket < 0) return value
  }
  return fallback
}

export function randomPiece(tuning: Tuning, drops: number, random = Math.random): Piece {
  const opening = Math.min(1, 0.26 + drops * 0.185)
  return {
    shape: weighted([
      ['standard', tuning.standardShape],
      ['tall', tuning.tallShape * opening],
      ['compact', tuning.compactShape * opening],
    ], 'standard', random),
    material: weighted([
      ['standard', tuning.standardMaterial],
      ['heavy', tuning.heavyMaterial * opening],
      ['slick', tuning.slickMaterial * opening],
    ], 'standard', random),
  }
}
