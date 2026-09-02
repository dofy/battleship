interface GameVersionProps {
  className?: string
}

export default function GameVersion({ className = '' }: GameVersionProps) {

  return (
    <span
      aria-label={`Game version ${__GAME_VERSION__}`}
      className={`font-mono text-[10px] tracking-wide text-zinc-500 ${className}`}
    >
      v{__GAME_VERSION__}
    </span>
  )
}
