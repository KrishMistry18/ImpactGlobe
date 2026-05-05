'use client'

import useSWR from 'swr'
import { useGlobeStore } from '@/store/useGlobeStore'
import type { ForexPair } from '@/store/types'

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' }).then((r) => r.json())

/** Fetch forex pairs and sync to Zustand store — refreshes every 60 seconds */
export function useForex() {
  const setForexPairs = useGlobeStore((s) => s.setForexPairs)

  const { data, error, isLoading, mutate } = useSWR<ForexPair[]>(
    '/api/forex/pairs',
    fetcher,
    {
      refreshInterval: 60_000,       // re-fetch every 60 seconds
      revalidateOnFocus: true,        // re-fetch when tab regains focus
      revalidateOnReconnect: true,
      dedupingInterval: 30_000,       // allow re-fetch after 30s (not 2s default)
      onSuccess: (pairs) => {
        if (pairs?.length) setForexPairs(pairs)
      },
    }
  )

  return { pairs: data ?? [], error, isLoading, refresh: mutate }
}
