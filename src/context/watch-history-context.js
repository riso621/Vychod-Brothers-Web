import { createContext, useContext } from 'react'

export const WatchHistoryContext = createContext(null)

export function useWatchHistory() {
  const context = useContext(WatchHistoryContext)
  if (!context) throw new Error('useWatchHistory musí byť použitý vo WatchHistoryProvider')
  return context
}

