// components/Board.js
// 通用 10×10 棋盘，支持布局模式（展示 hasShip）和攻击模式（可点击）
export default function Board({ board, onCellClick, interactive = false, label }) {
  const cols = ['A','B','C','D','E','F','G','H','I','J']

  function cellClass(cell) {
    let base = 'w-7 h-7 border border-blue-900 rounded-sm flex items-center justify-center text-xs '
    if (cell.attacked && cell.hasShip)  return base + 'bg-red-500'
    if (cell.attacked && !cell.hasShip) return base + 'bg-gray-600'
    if (cell.hasShip)                   return base + 'bg-indigo-500'
    if (interactive)                    return base + 'bg-blue-950 cursor-crosshair hover:bg-blue-800'
    return base + 'bg-blue-950'
  }

  return (
    <div>
      {label && <p className="text-xs text-gray-400 text-center mb-1">{label}</p>}
      <div className="inline-block">
        {/* 列标题 */}
        <div className="flex ml-6">
          {cols.map(c => <div key={c} className="w-7 text-center text-xs text-gray-500">{c}</div>)}
        </div>
        {board.map((row, r) => (
          <div key={r} className="flex items-center">
            <div className="w-6 text-xs text-gray-500 text-right pr-1">{r}</div>
            {row.map((cell, c) => (
              <div
                key={c}
                className={cellClass(cell)}
                onClick={() => interactive && onCellClick && onCellClick(r, c)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
