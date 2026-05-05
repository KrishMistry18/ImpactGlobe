'use client'

import { useEffect, useState } from 'react'
import { Wifi, WifiOff } from 'lucide-react'

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [showOffline, setShowOffline] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowOffline(false)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowOffline(true)
    }

    setIsOnline(navigator.onLine)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Only show when offline
  if (!showOffline) return null

  return (
    <div className="animate-slide-in flex items-center gap-2 rounded-lg border border-impact-critical/20 bg-bg-card px-4 py-2 shadow-lg">
      <WifiOff className="h-4 w-4 text-impact-critical" />
      <span className="text-sm font-medium text-text-secondary">
        Connection lost
      </span>
    </div>
  )
}
