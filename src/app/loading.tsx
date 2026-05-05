export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-impact-critical border-t-transparent animate-spin" />
        <p className="text-text-secondary font-display text-sm tracking-wide">
          LOADING IMPACT DATA...
        </p>
      </div>
    </div>
  )
}
