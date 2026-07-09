/**
 * 木结构构筑物
 * 程序化几何：木板路、木桥、小码头。固定手工艺感位置。
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from '../utils/mergeGeometry'
import { heightAt, getRiverPath, RIVER_HALF_WIDTH } from '../utils/terrain'
import { WATER_LEVEL } from '../config/constants'
import { PALETTE } from '../config/palette'

/** 沿沙滩边缘的木板路 */
function makeBoardwalk(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  // 沿 +x 方向一排木板，在沙滩上
  const start = [-20, 8]
  const end = [18, 14]
  const segs = 24
  for (let i = 0; i < segs; i++) {
    const t = i / segs
    const x = start[0] + (end[0] - start[0]) * t
    const z = start[1] + (end[1] - start[1]) * t
    const y = heightAt(x, z)
    if (y < 0.1 || y > 0.7) continue
    const plank = new THREE.BoxGeometry(1.4, 0.08, 0.5)
    plank.translate(x, y + 0.04, z)
    parts.push(plank)
    // 支撑桩
    const post = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 5)
    post.translate(x + 0.5, y - 0.26, z)
    parts.push(post)
  }
  return mergeGeometries(parts)
}

/** 跨河流的小木桥 */
function makeBridge(): { geo: THREE.BufferGeometry; pos: [number, number, number] } {
  // 找河流中段一个位置
  const path = getRiverPath(80)
  const idx = Math.floor(path.length * 0.45)
  const [x, z] = path[idx]
  const y = heightAt(x, z)
  const span = RIVER_HALF_WIDTH * 2 + 2
  const parts: THREE.BufferGeometry[] = []
  // 桥面
  const deck = new THREE.BoxGeometry(span, 0.12, 1.6)
  deck.translate(0, 0.8, 0)
  parts.push(deck)
  // 栏杆
  for (const s of [-0.7, 0.7]) {
    const rail = new THREE.BoxGeometry(span, 0.06, 0.06)
    rail.translate(0, 1.2, s)
    parts.push(rail)
    for (let i = -2; i <= 2; i++) {
      const post = new THREE.BoxGeometry(0.06, 0.45, 0.06)
      post.translate(i * (span / 5), 1.0, s)
      parts.push(post)
    }
  }
  // 支撑桩
  for (const px of [-span / 2 + 0.5, span / 2 - 0.5]) {
    const pile = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6)
    pile.translate(px, 0.2, 0)
    parts.push(pile)
  }
  return { geo: mergeGeometries(parts), pos: [x, y - 0.1, z] }
}

/** 伸入水中的小码头 */
function makeDock(): { geo: THREE.BufferGeometry; pos: [number, number, number] } {
  const parts: THREE.BufferGeometry[] = []
  const len = 6
  const segs = 8
  for (let i = 0; i < segs; i++) {
    const t = i / segs
    const z = -10 - t * len
    const y = Math.max(heightAt(30, z), WATER_LEVEL)
    const plank = new THREE.BoxGeometry(1.6, 0.08, 0.7)
    plank.translate(30, y + 0.04, z)
    parts.push(plank)
  }
  // 支撑桩
  for (let i = 0; i <= segs; i += 2) {
    const t = i / segs
    const z = -10 - t * len
    const y = Math.max(heightAt(30, z), WATER_LEVEL)
    for (const px of [-0.7, 0.7]) {
      const post = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 5)
      post.translate(30 + px, y - 0.46, z)
      parts.push(post)
    }
  }
  return { geo: mergeGeometries(parts), pos: [0, 0, 0] }
}

export default function Structures() {
  const boardwalk = useMemo(() => makeBoardwalk(), [])
  const bridge = useMemo(() => makeBridge(), [])
  const dock = useMemo(() => makeDock(), [])

  const woodMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PALETTE.woodLight,
        roughness: 0.9,
        metalness: 0.05,
        flatShading: true,
      }),
    [],
  )

  return (
    <group>
      <mesh geometry={boardwalk} material={woodMat} castShadow receiveShadow />
      <mesh geometry={bridge.geo} material={woodMat} position={bridge.pos} castShadow receiveShadow />
      <mesh geometry={dock.geo} material={woodMat} position={dock.pos} castShadow receiveShadow />
    </group>
  )
}
