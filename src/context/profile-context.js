import { createContext, useContext } from 'react'

export const ProfileContext = createContext(null)

export function useProfile() {
  const context = useContext(ProfileContext)
  if (!context) throw new Error('useProfile musí byť použitý v ProfileProvider')
  return context
}
