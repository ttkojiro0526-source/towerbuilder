import hya from './assets/hya.mp3?inline'
import wa from './assets/wa.mp3?inline'
import uwa from './assets/uwa.mp3?inline'
import gyaa from './assets/gyaa.mp3?inline'

export function readPreference(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function savePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // The game also runs in browser contexts with storage disabled.
  }
}

export class GameAudio {
  private drops = [hya, wa, uwa].map(url => new Audio(url))
  private collapse = new Audio(gyaa)
  private last = -1
  muted = readPreference('tower-builder.mute') === 'true'
  volume = Number(readPreference('tower-builder.volume') ?? 55)

  constructor() {
    if (!Number.isFinite(this.volume) || this.volume < 0 || this.volume > 100) this.volume = 55
    for (const audio of [...this.drops, this.collapse]) audio.preload = 'auto'
  }

  private updateVolume() {
    const gain = this.muted ? 0 : this.volume / 100
    for (const audio of this.drops) audio.volume = 0.46 * gain
    this.collapse.volume = 0.72 * gain
  }

  setMuted(muted: boolean) {
    this.muted = muted
    this.updateVolume()
    savePreference('tower-builder.mute', String(muted))
  }

  setVolume(volume: number) {
    this.volume = volume
    this.updateVolume()
    savePreference('tower-builder.volume', String(volume))
  }

  playDrop() {
    this.last = (this.last + 1 + Math.floor(Math.random() * (this.drops.length - 1))) % this.drops.length
    this.play(this.drops[this.last])
  }

  stop() {
    for (const audio of [...this.drops, this.collapse]) audio.pause()
  }

  playCollapse() {
    this.play(this.collapse)
  }

  private play(audio: HTMLAudioElement) {
    if (this.muted) return
    this.updateVolume()
    audio.currentTime = 0
    void audio.play().catch(() => {})
  }
}
