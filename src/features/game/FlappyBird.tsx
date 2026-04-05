import { useEffect, useRef } from 'react'
import { FlappyBirdGame } from './flappy-bird'

export function FlappyBird() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<FlappyBirdGame | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      if (gameRef.current) {
        gameRef.current.destroy()
      }
      gameRef.current = new FlappyBirdGame(canvas)
    }

    resizeCanvas()

    const observer = new ResizeObserver(resizeCanvas)
    observer.observe(canvas)

    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        gameRef.current?.jump()
      }
    }

    window.addEventListener('keydown', handleKey)

    return () => {
      gameRef.current?.destroy()
      observer.disconnect()
      window.removeEventListener('keydown', handleKey)
    }
  }, [])

  function handleInteraction() {
    gameRef.current?.jump()
  }

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full touch-none"
      onClick={handleInteraction}
      onTouchStart={(e) => {
        e.preventDefault()
        handleInteraction()
      }}
    />
  )
}
