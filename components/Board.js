// components/Board.js
export default function Board({ board, onCellClick, interactive = false, label }) {
  const cols = ['A','B','C','D','E','F','G','H','I','J']

  function cellClass(cell) {
    const base = 'w-8 h-8 border border-blue-900 rounded-sm flex items-center justify-center text-sm font-bold transition-colors '
    if (cell.attacked && cell.hasShip)  return base + 'bg-red-600 text-red-100 cursor-default'
    if (cell.attacked && !cell.hasShip) return base + 'bg-gray-700 text-gray-400 cursor-default'
    if (cell.hasShip)                   return base + 'bg-indigo-600 cursor-default'
    if (interactive)                    return base + 'bg-blue-900 cursor-crosshair hover:bg-blue-800 hover:border-blue-600'
    return base + 'bg-blue-900 cursor-default'
  }

  return (
    <div>
      {label && <p className="text-xs text-gray-400 text-center mb-2 tracking-wide">{label}</p>}
      <div className="inline-block p-2 bg-gray-800 border border-gray-700 rounded-lg">
        <div className="flex ml-6 mb-0.5">
          {cols.map(c => (
            <div key={c} className="w-8 text-center text-xs text-gray-500 font-mono">{c}</div>
          ))}
        </div>
        {board.map((row, r) => (
          <div key={r} className="flex items-center">
            <div className="w-6 text-xs text-gray-500 text-right pr-1 font-mono">{r}</div>
            {row.map((cell, c) => (
              <div
                key={c}
                className={cellClass(cell)}
                onClick={() => interactive && onCellClick && onCellClick(r, c)}
              >
                {cell.attacked && cell.hasShip  && <span>●</span>}
                {cell.attacked && !cell.hasShip && <span className="text-gray-500">·</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
