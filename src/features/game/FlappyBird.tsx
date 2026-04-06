import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { useProfile } from '@/features/profile/useProfile'
import { FlappyBirdGame } from './flappy-bird'

export function FlappyBird() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<FlappyBirdGame | null>(null)
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id ?? null)
  const queryClient = useQueryClient()

  async function saveHighscore(score: number) {
    if (!user) return
    await supabase
      .from('profiles')
      .update({ flappy_highscore: score })
      .eq('id', user.id)
    queryClient.invalidateQueries({ queryKey: ['profile', user.id] })
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const initialBest = profile?.flappy_highscore ?? 0

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      gameRef.current?.destroy()
      gameRef.current = new FlappyBirdGame(canvas, initialBest, saveHighscore)
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
  // Re-initialize game when profile highscore is first loaded
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.flappy_highscore])

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
