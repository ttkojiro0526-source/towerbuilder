export class CollapseChain {
  private members = new Set<number>()
  private latestLoss = -Infinity
  total = 0

  constructor(private windowMs: () => number) {}

  expire(now: number) {
    if (now - this.latestLoss > this.windowMs()) this.members.clear()
  }

  lose(id: number, now: number) {
    this.expire(now)
    if (!this.members.has(id)) {
      this.members.add(id)
      this.latestLoss = now
      this.total++
    }
    return this.members.size
  }

  get count() {
    return this.members.size
  }
}

type SupportSample = {
  supported: boolean
  y: number
  speed: number
  angularSpeed: number
}

export class FloorState {
  attached = false
  wasAttached = false
  everLost = false
  supportedFor = 0
  unsupportedFor = 0
  referenceY = 0

  sample(sample: SupportSample, dt: number, joinGrace: number, collapseGrace: number, distance: number) {
    const settled = sample.supported && sample.speed < 2.8 && sample.angularSpeed < 0.085
    if (!this.attached) {
      this.supportedFor = settled ? this.supportedFor + dt : 0
      if (this.supportedFor >= joinGrace) {
        this.attached = true
        this.wasAttached = true
        this.referenceY = sample.y
        this.unsupportedFor = 0
        return 'joined'
      }
      return
    }

    if (!sample.supported) {
      this.unsupportedFor += dt
      this.supportedFor = 0
    } else if (this.unsupportedFor > 0) {
      this.supportedFor = settled ? this.supportedFor + dt : 0
      if (this.supportedFor < joinGrace) this.unsupportedFor += dt
    }

    if (this.unsupportedFor >= collapseGrace && sample.y - this.referenceY >= distance) {
      this.detach()
      return 'lost'
    }

    if (settled && (this.unsupportedFor === 0 || this.supportedFor >= joinGrace)) {
      this.referenceY = sample.y
      this.unsupportedFor = 0
    }
  }

  detach() {
    this.attached = false
    this.everLost = true
    this.supportedFor = 0
    this.unsupportedFor = 0
  }
}
