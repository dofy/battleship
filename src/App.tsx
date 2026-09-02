import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'

const RoomPage = lazy(() => import('./pages/RoomPage'))

function RouteFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="space-y-3 text-center" role="status">
        <div className="text-3xl" aria-hidden="true">⚓</div>
        <p className="tracking-widest text-zinc-400">CHARTING COURSE…</p>
      </div>
    </main>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:id" element={<RoomPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
