/**
 * 展台底座
 * 深色平台在场景下方，模拟博物馆展示台的底座——强化"物理模型"感。
 * 从版本 A 移入。
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { WORLD_SIZE } from '../config/constants'

export default function ExhibitionBase() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(WORLD_SIZE * 0.9, WORLD_SIZE * 0.9)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#2c2c2c'),
        roughness: 0.6,
        metalness: 0.1,
      }),
    [],
  )

  return <mesh geometry={geometry} material={material} position={[0, -1.2, 0]} receiveShadow />
}
