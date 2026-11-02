import { createContext, useContext } from 'react'
export const ViewerProfileContext=createContext(null)
export function useViewerProfile(){const value=useContext(ViewerProfileContext);if(!value)throw new Error('useViewerProfile must be used inside ViewerProfileProvider');return value}
