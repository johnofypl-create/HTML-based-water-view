import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

function PostProcessing() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.4}
        luminanceThreshold={0.7}
        luminanceSmoothing={0.9}
        blendFunction={BlendFunction.SCREEN}
        mipmapBlur
      />
      <Vignette
        offset={0.4}
        darkness={0.35}
        blendFunction={BlendFunction.NORMAL}
      />
      <ToneMapping
        mode={2} // ACESFilmic
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  )
}

export default PostProcessing
