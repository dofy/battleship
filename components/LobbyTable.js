// components/LobbyTable.js
export default function LobbyTable({ rooms, onJoin }) {
  if (!rooms?.length) return <p className="text-gray-500 text-sm">暂无公开房间</p>
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="text-indigo-400 border-b border-blue-900">
          <th className="text-left py-2 px-3">房主</th>
          <th className="text-left py-2 px-3">状态</th>
          <th className="py-2 px-3"></th>
        </tr>
      </thead>
      <tbody>
        {rooms.map(r => (
          <tr key={r.id} className="border-b border-blue-950">
            <td className="py-2 px-3">{r.hostNickname}</td>
            <td className="py-2 px-3 text-green-400">等待中</td>
            <td className="py-2 px-3">
              <button onClick={() => onJoin(r.id)}
                      className="px-3 py-1 bg-indigo-600 text-white rounded text-xs">
                加入
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
