// components/GameOverOverlay.js
import { useEffect, useRef } from 'react'

function Confetti() {
  const ref = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const COLORS = ['#FFD700','#FFA500','#E0E0E0','#A8C8E8','#B8D4B8','#FFD080','#C0C8D0','#F0E0A0']
    const particles = Array.from({ length: 130 }, () => ({
      x:   Math.random() * window.innerWidth,
      y:   Math.random() * window.innerHeight - window.innerHeight,
      w:   Math.random() * 12 + 4,
      h:   Math.random() * 7  + 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vy:  Math.random() * 3 + 1.5,
      vx:  (Math.random() - 0.5) * 2,
      rot: Math.random() * Math.PI * 2,
      vr:  (Math.random() - 0.5) * 0.12,
    }))

    let id
    function draw() {
      if (document.hidden) {
        id = requestAnimationFrame(draw)
        return
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of particles) {
        p.y += p.vy; p.x += p.vx; p.rot += p.vr
        if (p.y > canvas.height + 10) { p.y = -10; p.x = Math.random() * canvas.width }
        ctx.save()
        ctx.globalAlpha = 0.88
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }
      id = requestAnimationFrame(draw)
    }
    draw()

    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={ref} className="absolute inset-0 pointer-events-none w-full h-full" />
}

function Bubbles() {
  const items = [
    { left: '8%',  size: 10, dur: 4.2, delay: 0   },
    { left: '18%', size: 16, dur: 5.8, delay: 0.7  },
    { left: '28%', size: 8,  dur: 3.9, delay: 1.4  },
    { left: '38%', size: 20, dur: 6.5, delay: 0.3  },
    { left: '48%', size: 12, dur: 4.8, delay: 2.1  },
    { left: '58%', size: 7,  dur: 3.6, delay: 0.9  },
    { left: '67%', size: 18, dur: 5.2, delay: 1.8  },
    { left: '76%', size: 9,  dur: 4.5, delay: 0.5  },
    { left: '85%', size: 14, dur: 5.0, delay: 1.2  },
    { left: '93%', size: 11, dur: 4.1, delay: 2.5  },
  ]
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {items.map((b, i) => (
        <span
          key={i}
          className="bubble absolute bottom-0 rounded-full border border-zinc-600/40 bg-zinc-700/20"
          style={{
            left: b.left,
            width:  b.size,
            height: b.size,
            animationDuration:  `${b.dur}s`,
            animationDelay:     `${b.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function GameOverOverlay({ result, onDismiss }) {
  const isWin = result === 'win'

  useEffect(() => {
    const t = setTimeout(onDismiss, 7000)
    return () => clearTimeout(t)
  }, [onDismiss])

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  return (
    <>
      <div
        className={`overlay fixed inset-0 z-50 flex items-center justify-center cursor-pointer overflow-hidden ${
          isWin
            ? 'bg-black/75'
            : 'bg-zinc-950/95'
        }`}
        onClick={onDismiss}
        role="dialog"
        aria-modal="true"
        aria-labelledby="battle-result-title"
      >
        {isWin  && <Confetti />}
        {!isWin && <Bubbles />}

        {!isWin && (
          <div
            className="wave absolute bottom-0 left-0 right-0 h-32 bg-zinc-800/50"
            style={{ marginBottom: -8 }}
          />
        )}

        <div className="card relative z-10 text-center select-none px-8 py-8 sm:px-12 sm:py-10 rounded-2xl mx-4"
          onClick={event => event.stopPropagation()}
          style={{ background: isWin ? 'rgba(0,0,0,0.45)' : 'rgba(15,20,30,0.7)', backdropFilter: 'blur(8px)' }}
        >
          <div className="text-7xl sm:text-8xl mb-4 sm:mb-5" style={{ lineHeight: 1 }}>
            {isWin
              ? <span className="animate-bounce inline-block">🏆</span>
              : <span className="skull">💀</span>
            }
          </div>

          {isWin ? (
            <div id="battle-result-title" className="gold text-4xl sm:text-5xl font-black tracking-widest text-yellow-400">
              V I C T O R Y
            </div>
          ) : (
            <div id="battle-result-title" className="text-4xl sm:text-5xl font-black tracking-widest text-zinc-300">
              D E F E A T
            </div>
          )}

          <button
            type="button"
            autoFocus
            onClick={onDismiss}
            className="mt-6 min-h-11 rounded-lg border border-zinc-600 bg-zinc-900/80 px-5 py-2 text-sm tracking-widest text-zinc-200 hover:bg-zinc-800"
          >
            Continue
          </button>
        </div>
      </div>
    </>
  )
}
