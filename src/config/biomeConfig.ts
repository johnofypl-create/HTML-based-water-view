/**
 * @module config/biomeConfig
 * @layer config（叶子层）
 * @purpose 生物群系枚举/高度带/密度配置
 * @dependsOn []
 * @exports [Biome, BiomeInfo, BIOME_HEIGHTS, BIOME_SLOPES, classifyBiome, BIOME_DENSITY]
 * @aiEdit
 *   - 改本文件导出的 Biome、BiomeInfo、BIOME_HEIGHTS、BIOME_SLOPES、classifyBiome、BIOME_DENSITY 即可；依赖见 @dependsOn
 */
/**
 * Biome 配置
 * 按高度 + 坡度判定地形生态，决定材质颜色与植被密度。
 */

export enum Biome {
  DeepSea = 0,    // 深海床
  ShallowSea = 1, // 浅海床（水下植被/珊瑚）
  WetSand = 2,    // 湿沙/泡沫线
  Beach = 3,      // 沙滩
  Dune = 4,       // 沙丘
  Grass = 5,      // 草地
  Forest = 6,     // 林地
  Rock = 7,       // 岩石/悬崖
}

export interface BiomeInfo {
  id: Biome
  name: string
  /** 该 biome 下各植被物种的相对密度（0 = 不放置） */
  density: {
    grass: number
    flower: number
    bush: number
    tree: number
    rock: number
    driftwood: number
  }
}

/** 高度阈值（与 SEA_LEVEL=0 相对） */
export const BIOME_HEIGHTS = {
  deepSea: -2.0,
  shallowSea: -0.35,
  wetSand: 0.12,
  beach: 0.55,
  dune: 1.1,
  grass: 2.6,
  forest: 5.2,
} as const

/** 坡度阈值（弧度） */
export const BIOME_SLOPES = {
  /** 超过此坡度归为岩石 */
  rock: (32 * Math.PI) / 180,
  /** 超过此坡度不种草/树 */
  steep: (28 * Math.PI) / 180,
} as const

/** 根据 heightAt 输出的高度 + 坡度判定 biome */
export function classifyBiome(height: number, slope: number): Biome {
  if (height < BIOME_HEIGHTS.deepSea) return Biome.DeepSea
  if (height < BIOME_HEIGHTS.shallowSea) return Biome.ShallowSea
  if (height < BIOME_HEIGHTS.wetSand) return Biome.WetSand
  // 陆地：先判坡度
  if (slope > BIOME_SLOPES.rock || height > BIOME_HEIGHTS.forest + 1.5) return Biome.Rock
  if (height < BIOME_HEIGHTS.beach) return Biome.Beach
  if (height < BIOME_HEIGHTS.dune) return Biome.Dune
  if (slope > BIOME_SLOPES.steep) return Biome.Rock
  if (height < BIOME_HEIGHTS.grass) return Biome.Grass
  if (height < BIOME_HEIGHTS.forest) return Biome.Forest
  return Biome.Rock
}

/** 各 biome 的植被密度配置 */
export const BIOME_DENSITY: Record<Biome, BiomeInfo['density']> = {
  [Biome.DeepSea]:    { grass: 0, flower: 0, bush: 0, tree: 0, rock: 0.2, driftwood: 0 },
  [Biome.ShallowSea]: { grass: 0, flower: 0, bush: 0, tree: 0, rock: 0.3, driftwood: 0 },
  [Biome.WetSand]:    { grass: 0, flower: 0, bush: 0, tree: 0, rock: 0.1, driftwood: 0.6 },
  [Biome.Beach]:      { grass: 0.05, flower: 0.02, bush: 0, tree: 0, rock: 0.05, driftwood: 0.8 },
  [Biome.Dune]:       { grass: 0.25, flower: 0.08, bush: 0.15, tree: 0, rock: 0.1, driftwood: 0.2 },
  [Biome.Grass]:      { grass: 1.0, flower: 0.35, bush: 0.4, tree: 0.15, rock: 0.08, driftwood: 0 },
  [Biome.Forest]:     { grass: 0.5, flower: 0.1, bush: 0.6, tree: 0.9, rock: 0.15, driftwood: 0 },
  [Biome.Rock]:       { grass: 0.1, flower: 0.03, bush: 0.2, tree: 0.05, rock: 0.7, driftwood: 0 },
}
