import { useEffect } from 'react'
import { audioManager } from './AudioManager'

function AudioSystem() {
  useEffect(() => {
    // Initialize audio on first user interaction
    const handleInteraction = () => {
      audioManager.init()
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
    }
    
    window.addEventListener('click', handleInteraction)
    window.addEventListener('keydown', handleInteraction)
    
    return () => {
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
    }
  }, [])
  
  return null // This component renders nothing visually
}

export default AudioSystem