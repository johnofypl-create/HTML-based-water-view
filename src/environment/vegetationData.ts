/**
 * @module environment/vegetationData
 * @layer environment（域层）
 * @purpose 植被实例数据（草/花/灌木/树/漂流木布点）
 * @dependsOn ['utils/sampling', 'config/constants']
 * @exports [getVegetation]
 * @aiEdit
 *   - 改本文件导出的 getVegetation 即可；依赖见 @dependsOn
 */
/**
 * 植被实例数据生成（缓存）
 * 用 sampling.ts 为各物种生成实例数组。地形/水/植被共用 heightAt 保证一致。
 */
import { sampleVegetation, VegetationInstance, SpeciesKey } from '../utils/sampling'
import { PERF, SEED } from '../config/constants'

const cache = new Map<SpeciesKey, VegetationInstance[]>()

export function getVegetation(species: SpeciesKey): VegetationInstance[] {
  if (cache.has(species)) return cache.get(species)!
  let data: VegetationInstance[]
  switch (species) {
    case 'grass':
      data = sampleVegetation('grass', PERF.grassCount, SEED, true)
      break
    case 'flower':
      data = sampleVegetation('flower', PERF.flowerCount, SEED + 1, true)
      break
    case 'bush':
      data = sampleVegetation('bush', PERF.bushCount, SEED + 2, true)
      break
    case 'tree':
      data = sampleVegetation('tree', PERF.treeCount, SEED + 3, true)
      break
    case 'rock':
      data = sampleVegetation('rock', PERF.rockCount, SEED + 4, false)
      break
    case 'driftwood':
      data = sampleVegetation('driftwood', PERF.driftwoodCount, SEED + 5, false)
      break
  }
  cache.set(species, data)
  return data
}
