// components/GameOverOverlay.js
import { useEffect, useRef } from 'react'

function Confetti() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const COLORS = ['#FFD700','#FF6B6B','#4ECDC4','#45B7D1','#C0BDFF','#FF9F9F','#98D8C8','#FFEAA7']
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
          className="bubble absolute bottom-0 rounded-full border border-blue-700/40 bg-blue-900/20"
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

  return (
    <>
      <style jsx>{`
        @keyframes overlayIn {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes cardIn {
          from { transform: scale(0.5) translateY(40px); opacity: 0 }
          to   { transform: scale(1)   translateY(0);    opacity: 1 }
        }
        @keyframes goldGlow {
          0%,100% { text-shadow: 0 0 16px #FFD700, 0 0 32px #FFB300 }
          50%     { text-shadow: 0 0 32px #FFD700, 0 0 64px #FF8C00, 0 0 80px #FF6B00 }
        }
        @keyframes sway {
          0%,100% { transform: rotate(-6deg) }
          50%     { transform: rotate(6deg)  }
        }
        @keyframes bubble {
          0%   { transform: translateY(0)     scale(1);   opacity: 0.5 }
          80%  { opacity: 0.4 }
          100% { transform: translateY(-100vh) scale(0.3); opacity: 0   }
        }
        @keyframes wave {
          0%,100% { border-radius: 48% 52% 44% 56% / 52% 48% 52% 48% }
          50%     { border-radius: 56% 44% 52% 48% / 44% 56% 44% 56% }
        }
        .overlay  { animation: overlayIn 0.35s ease-out both }
        .card     { animation: cardIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both }
        .gold     { animation: goldGlow 2.2s ease-in-out infinite }
        .skull    { animation: sway 2.4s ease-in-out infinite; display: inline-block }
        .bubble   { animation: bubble linear infinite both }
        .wave     { animation: wave 3s ease-in-out infinite }
      `}</style>

      <div
        className={`overlay fixed inset-0 z-50 flex items-center justify-center cursor-pointer overflow-hidden ${
          isWin
            ? 'bg-black/75'
            : 'bg-gray-900/95'
        }`}
        onClick={onDismiss}
      >
        {isWin  && <Confetti />}
        {!isWin && <Bubbles />}

        {/* 失败：底部波浪层 */}
        {!isWin && (
          <div
            className="wave absolute bottom-0 left-0 right-0 h-32 bg-blue-950/60"
            style={{ marginBottom: -8 }}
          />
        )}

        <div className="card relative z-10 text-center select-none px-12 py-10 rounded-2xl"
          style={{ background: isWin ? 'rgba(0,0,0,0.45)' : 'rgba(10,20,40,0.6)', backdropFilter: 'blur(8px)' }}
        >
          <div className="text-8xl mb-5" style={{ lineHeight: 1 }}>
            {isWin
              ? <span className="animate-bounce inline-block">🏆</span>
              : <span className="skull">💀</span>
            }
          </div>

          {isWin ? (
            <div className="gold text-5xl font-black tracking-widest text-yellow-400">
              胜 利 ！
            </div>
          ) : (
            <div className="text-5xl font-black tracking-widest text-blue-400">
              落 败 …
            </div>
          )}

          <p className="mt-6 text-gray-500 text-xs tracking-widest">点击任意处继续</p>
        </div>
      </div>
    </>
  )
}
