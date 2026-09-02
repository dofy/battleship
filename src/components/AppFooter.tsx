const currentYear = new Date().getFullYear()

export default function AppFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-900 px-4 py-4 text-center text-[11px] tracking-wide text-zinc-600 sm:px-6">
      <p>© {currentYear} Battleship. Built for captains everywhere.</p>
    </footer>
  )
}
