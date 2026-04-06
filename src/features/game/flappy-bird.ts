const GRAVITY = 0.38
const JUMP_VELOCITY = -7.5
const PIPE_SPEED = 2.4
const PIPE_WIDTH = 54
const PIPE_GAP = 158
const BIRD_X = 80
const BIRD_RADIUS = 14
const PIPE_INTERVAL_MS = 1900

interface Pipe {
  x: number
  topHeight: number
  scored: boolean
}

type GameState = 'idle' | 'playing' | 'dead'

export class FlappyBirdGame {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private state: GameState = 'idle'
  private birdY = 0
  private birdVelocity = 0
  private pipes: Pipe[] = []
  private score = 0
  private bestScore = 0
  private animationId: number | null = null
  private pipeTimer: ReturnType<typeof setTimeout> | null = null
  private onNewHighscore: ((score: number) => void) | null = null

  constructor(canvas: HTMLCanvasElement, initialBestScore = 0, onNewHighscore?: (score: number) => void) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.birdY = canvas.height / 2
    this.bestScore = initialBestScore
    this.onNewHighscore = onNewHighscore ?? null
    this.render()
  }

  jump() {
    if (this.state === 'idle') {
      this.start()
    } else if (this.state === 'playing') {
      this.birdVelocity = JUMP_VELOCITY
    } else if (this.state === 'dead') {
      this.reset()
    }
  }

  destroy() {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId)
    if (this.pipeTimer !== null) clearTimeout(this.pipeTimer)
  }

  private start() {
    this.state = 'playing'
    this.birdVelocity = JUMP_VELOCITY
    this.pipes = []
    this.score = 0
    this.schedulePipe()
    this.loop()
  }

  private reset() {
    this.destroy()
    this.birdY = this.canvas.height / 2
    this.birdVelocity = 0
    this.pipes = []
    this.score = 0
    this.state = 'idle'
    this.animationId = null
    this.pipeTimer = null
    this.render()
  }

  private schedulePipe() {
    this.pipeTimer = setTimeout(() => {
      if (this.state !== 'playing') return
      const min = 50
      const max = this.canvas.height - PIPE_GAP - min - 20
      this.pipes.push({
        x: this.canvas.width,
        topHeight: min + Math.random() * max,
        scored: false,
      })
      this.schedulePipe()
    }, PIPE_INTERVAL_MS)
  }

  private loop() {
    this.animationId = requestAnimationFrame(() => {
      if (this.state !== 'playing') return
      this.update()
      this.render()
      this.loop()
    })
  }

  private update() {
    this.birdVelocity += GRAVITY
    this.birdY += this.birdVelocity

    // Remove off-screen pipes, score passing ones
    this.pipes = this.pipes.filter((p) => p.x > -PIPE_WIDTH)
    for (const pipe of this.pipes) {
      pipe.x -= PIPE_SPEED
      if (!pipe.scored && pipe.x + PIPE_WIDTH < BIRD_X) {
        pipe.scored = true
        this.score++
      }
    }

    // Ceiling / ground collision
    const groundY = this.canvas.height - 20
    if (this.birdY - BIRD_RADIUS < 0 || this.birdY + BIRD_RADIUS > groundY) {
      this.die()
      return
    }

    // Pipe collision
    for (const pipe of this.pipes) {
      if (
        BIRD_X + BIRD_RADIUS > pipe.x &&
        BIRD_X - BIRD_RADIUS < pipe.x + PIPE_WIDTH &&
        (this.birdY - BIRD_RADIUS < pipe.topHeight ||
          this.birdY + BIRD_RADIUS > pipe.topHeight + PIPE_GAP)
      ) {
        this.die()
        return
      }
    }
  }

  private die() {
    if (this.score > this.bestScore) {
      this.bestScore = this.score
      this.onNewHighscore?.(this.score)
    }
    this.state = 'dead'
    if (this.pipeTimer !== null) clearTimeout(this.pipeTimer)
    if (this.animationId !== null) cancelAnimationFrame(this.animationId)
    this.animationId = null
    this.render()
  }

  private render() {
    const { ctx } = this
    const W = this.canvas.width
    const H = this.canvas.height

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, '#87CEEB')
    sky.addColorStop(1, '#B0E2FF')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, H)

    // Ground
    ctx.fillStyle = '#8B6914'
    ctx.fillRect(0, H - 20, W, 20)
    ctx.fillStyle = '#5D9E31'
    ctx.fillRect(0, H - 26, W, 8)

    // Pipes
    for (const pipe of this.pipes) {
      this.drawPipe(pipe.x, 0, PIPE_WIDTH, pipe.topHeight, false)
      const bottomY = pipe.topHeight + PIPE_GAP
      this.drawPipe(pipe.x, bottomY, PIPE_WIDTH, H - bottomY - 20, true)
    }

    // Bird
    this.drawBird()

    // Score
    if (this.state === 'playing' || this.state === 'dead') {
      ctx.font = 'bold 34px Arial'
      ctx.textAlign = 'center'
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.lineWidth = 3
      ctx.strokeText(String(this.score), W / 2, 52)
      ctx.fillStyle = 'white'
      ctx.fillText(String(this.score), W / 2, 52)
    }

    // Overlays
    if (this.state === 'idle') {
      this.drawOverlay('Flappy Bird', 'Kliknij lub naciśnij spację')
    } else if (this.state === 'dead') {
      this.drawOverlay(
        `Wynik: ${this.score}`,
        `Rekord: ${this.bestScore}  •  Kliknij aby zagrać ponownie`,
      )
    }
  }

  private drawPipe(x: number, y: number, w: number, h: number, isBottom: boolean) {
    const { ctx } = this
    const cap = 22
    const overhang = 5

    const grad = ctx.createLinearGradient(x, 0, x + w, 0)
    grad.addColorStop(0, '#3D8B37')
    grad.addColorStop(0.35, '#5CB85C')
    grad.addColorStop(1, '#2E6B2A')
    ctx.fillStyle = grad
    ctx.fillRect(x, y, w, h)

    // Cap
    const capGrad = ctx.createLinearGradient(x - overhang, 0, x + w + overhang, 0)
    capGrad.addColorStop(0, '#357A32')
    capGrad.addColorStop(0.35, '#4CAF50')
    capGrad.addColorStop(1, '#256325')
    ctx.fillStyle = capGrad
    if (isBottom) {
      ctx.fillRect(x - overhang, y, w + overhang * 2, cap)
    } else {
      ctx.fillRect(x - overhang, y + h - cap, w + overhang * 2, cap)
    }
  }

  private drawBird() {
    const { ctx } = this
    const angle = Math.min(Math.max(this.birdVelocity * 0.07, -0.45), 0.65)

    ctx.save()
    ctx.translate(BIRD_X, this.birdY)
    ctx.rotate(angle)

    // Body
    const bodyGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, BIRD_RADIUS)
    bodyGrad.addColorStop(0, '#FFE566')
    bodyGrad.addColorStop(1, '#FFA500')
    ctx.fillStyle = bodyGrad
    ctx.beginPath()
    ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#CC6600'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Wing
    ctx.fillStyle = '#FF9500'
    ctx.beginPath()
    ctx.ellipse(-3, 4, 9, 4, -0.25, 0, Math.PI * 2)
    ctx.fill()

    // Eye white
    ctx.fillStyle = 'white'
    ctx.beginPath()
    ctx.arc(5, -4, 5.5, 0, Math.PI * 2)
    ctx.fill()

    // Pupil
    ctx.fillStyle = '#1a1a1a'
    ctx.beginPath()
    ctx.arc(6.5, -4, 2.5, 0, Math.PI * 2)
    ctx.fill()

    // Beak
    ctx.fillStyle = '#FF6B35'
    ctx.beginPath()
    ctx.moveTo(10, -2)
    ctx.lineTo(17, 0)
    ctx.lineTo(10, 3)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }

  private drawOverlay(title: string, subtitle: string) {
    const { ctx } = this
    const W = this.canvas.width
    const H = this.canvas.height

    ctx.fillStyle = 'rgba(0,0,0,0.42)'
    ctx.fillRect(0, 0, W, H)

    // Card
    const cardW = Math.min(W - 40, 280)
    const cardX = (W - cardW) / 2
    const cardY = H / 2 - 50
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.beginPath()
    ctx.roundRect(cardX, cardY, cardW, 100, 16)
    ctx.fill()

    ctx.fillStyle = '#1a1a1a'
    ctx.font = 'bold 22px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(title, W / 2, cardY + 38)

    ctx.fillStyle = '#555'
    ctx.font = '13px Arial'
    ctx.fillText(subtitle, W / 2, cardY + 68)
  }
}
