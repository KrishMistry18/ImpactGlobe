'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[App Error]', error)
  }, [error])

  return (
    <div
      className="flex h-screen w-screen flex-col items-center justify-center gap-6"
      style={{ background: '#050a14', color: '#f1f0e8' }}
    >
      <h1 className="font-display text-2xl font-bold text-impact-critical">
        Something went wrong
      </h1>
      <p className="max-w-md text-center text-sm text-text-muted">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-impact-medium px-6 py-2 text-sm font-medium text-white hover:bg-impact-medium/80"
      >
        Try again
      </button>
    </div>
  )
}
