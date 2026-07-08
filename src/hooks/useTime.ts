import { useState, useCallback, useMemo } from 'react'
import type { TimeOfDay, TimeState } from '../types'
import { getSunPosition, getMoonPosition } from '../utils/math'
import { TIME_PRESETS } from '../config/constants'

export function useTime(initialHour = 16) {
  const [hour, setHour] = useState(initialHour)
  
  const timeOfDay = useMemo((): TimeOfDay => {
    if (hour >= 5 && hour < 8) return 'morning'
    if (hour >= 8 && hour < 11) return 'noon'  
    if (hour >= 11 && hour < 17) return 'afternoon'
    if (hour >= 17 && hour < 20) return 'sunset'
    return 'night'
  }, [hour])
  
  const timeState = useMemo((): TimeState => {
    // Calculate sun/moon positions, intensities, colors based on hour
    const sunAngle = ((hour - 6) / 12) * Math.PI // 0 at 6am, PI at 6pm
    const sunHeight = Math.sin(sunAngle)
    const normalizedHeight = Math.max(0, sunHeight)
    
    // Sun intensity: 0 at night, 1.5 at noon
    const sunIntensity = normalizedHeight * 1.5
    
    // Ambient: 0.15 at night, 0.5 at noon
    const ambientIntensity = 0.15 + normalizedHeight * 0.35
    
    // Shadow length: longer when sun is low
    const shadowLength = 1 + (1 - normalizedHeight) * 3
    
    // Fog color changes with time
    let fogColor: string
    let skyColor: string
    if (sunHeight > 0.5) {
      // 正午——清澈蓝
      fogColor = '#c8d8e8'
      skyColor = '#87ceeb'
    } else if (sunHeight > 0.15) {
      // 早晨/傍晚——暖金
      fogColor = '#e8d8c0'
      skyColor = '#e8c8a0'
    } else if (sunHeight > -0.1) {
      // 日落/日出地平线——温暖橙
      fogColor = '#e8b898'
      skyColor = '#d4705a'
    } else if (sunHeight > -0.3) {
      // 暮色——深紫
      fogColor = '#2a1a3e'
      skyColor = '#2a1a4e'
    } else {
      // 夜晚——深蓝黑
      fogColor = '#1a1a2e'
      skyColor = '#1a1a3e'
    }
    
    return {
      hour,
      timeOfDay,
      sunPosition: getSunPosition(hour),
      moonPosition: getMoonPosition(hour),
      ambientIntensity,
      sunIntensity,
      fogColor,
      skyColor,
      shadowLength,
    }
  }, [hour])
  
  const setTimePreset = useCallback((preset: keyof typeof TIME_PRESETS) => {
    setHour(TIME_PRESETS[preset].hour)
  }, [])
  
  return { hour, setHour, timeOfDay, timeState, setTimePreset }
}
