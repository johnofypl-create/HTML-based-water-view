/**
 * 植被总管
 * 组合所有环境元素：草/花/灌木/树/岩石/漂流木/云/鸟/鱼。
 * 各组件自管理实例与动画。
 */
import Grass from './Grass'
import Flowers from './Flowers'
import Bushes from './Bushes'
import Forest from './Forest'
import Rocks from './Rocks'
import Driftwood from './Driftwood'
import Clouds from './Clouds'
import Birds from './Birds'
import Fish from './Fish'
import Particles from './Particles'
import MarineElements from './MarineElements'

export default function Vegetation() {
  return (
    <>
      <Grass />
      <Flowers />
      <Bushes />
      <Forest />
      <Rocks />
      <Driftwood />
      <MarineElements />
      <Clouds />
      <Birds />
      <Fish />
      <Particles />
    </>
  )
}
