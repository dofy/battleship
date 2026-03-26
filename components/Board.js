// components/Board.js
export default function Board({ board, onCellClick, interactive = false, label, lastAttack }) {
  const cols = ['A','B','C','D','E','F','G','H','I','J']

  function shipShape(cell) {
    if (!cell.hasShip) return 'rounded-sm'
    if (!cell.isBow && !cell.isStern) return 'rounded-none'
    if (cell.shipDir === 'H') {
      if (cell.isBow)   return 'rounded-l-full rounded-r-none'
      if (cell.isStern) return 'rounded-r-lg   rounded-l-none'
    } else {
      if (cell.isBow)   return 'rounded-t-full rounded-b-none'
      if (cell.isStern) return 'rounded-b-lg   rounded-t-none'
    }
    return 'rounded-sm'
  }

  function cellClass(cell) {
    const base = `w-8 h-8 border border-zinc-800 ${shipShape(cell)} flex items-center justify-center text-sm font-bold transition-colors relative overflow-visible `
    if (cell.attacked && cell.hasShip)  return base + 'bg-red-800 text-red-200 cursor-default'
    if (cell.attacked && !cell.hasShip) return base + 'bg-zinc-800 text-zinc-600 cursor-default'
    if (cell.hasShip)                   return base + 'bg-teal-800 cursor-default'
    if (interactive)                    return base + 'bg-zinc-900 cursor-crosshair hover:bg-zinc-700 hover:border-sky-600'
    return base + 'bg-zinc-900 cursor-default'
  }

  return (
    <div>
      <style jsx>{`
        @keyframes explode {
          0%   { transform: scale(0.4) rotate(-10deg); opacity: 1; }
          50%  { transform: scale(2.0) rotate(5deg);   opacity: 0.9; }
          100% { transform: scale(3.2) rotate(15deg);  opacity: 0; }
        }
        @keyframes ripple {
          0%   { transform: scale(0.2); opacity: 1;   border-width: 4px; }
          100% { transform: scale(2.8); opacity: 0;   border-width: 1px; }
        }
        @keyframes ripple2 {
          0%   { transform: scale(0.2); opacity: 0.7; border-width: 3px; }
          100% { transform: scale(2.2); opacity: 0;   border-width: 1px; }
        }
        .hit-fx {
          position: absolute;
          inset: -4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.6rem;
          line-height: 1;
          animation: explode 0.65s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          pointer-events: none;
          z-index: 20;
        }
        .miss-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 4px solid #7dd3fc;
          animation: ripple 0.7s ease-out forwards;
          pointer-events: none;
          z-index: 20;
        }
        .miss-ring2 {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 3px solid #bae6fd;
          animation: ripple2 0.9s ease-out forwards;
          pointer-events: none;
          z-index: 20;
        }
      `}</style>

      {label && <p className="text-sm text-zinc-500 text-center mb-2 tracking-wide">{label}</p>}
      <div className="inline-block p-2 bg-zinc-900 border border-zinc-700 rounded-lg">
        <div className="flex ml-6 mb-0.5">
          {cols.map(c => (
            <div key={c} className="w-8 text-center text-sm text-zinc-600 font-mono">{c}</div>
          ))}
        </div>
        {board.map((row, r) => (
          <div key={r} className="flex items-center">
            <div className="w-6 text-sm text-zinc-600 text-right pr-1 font-mono">{r}</div>
            {row.map((cell, c) => {
              const isTarget = lastAttack && lastAttack.row === r && lastAttack.col === c && lastAttack.result
              return (
                <div
                  key={c}
                  className={cellClass(cell)}
                  onClick={() => interactive && onCellClick && onCellClick(r, c)}
                >
                  {cell.attacked && cell.hasShip  && <span>●</span>}
                  {cell.attacked && !cell.hasShip && <span className="text-zinc-600">·</span>}
                  {isTarget && lastAttack.result === 'hit'  && (
                    <div key={`hfx-${lastAttack.ts}`} className="hit-fx">💥</div>
                  )}
                  {isTarget && lastAttack.result === 'miss' && (
                    <>
                      <div key={`mfx1-${lastAttack.ts}`} className="miss-ring"  />
                      <div key={`mfx2-${lastAttack.ts}`} className="miss-ring2" />
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
