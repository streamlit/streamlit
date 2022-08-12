import React, { FC, memo } from "react"

/*
 * IMPORTANT: If you change the asset imports below, make sure they still work if Streamlit is
 * served from a subpath.
 */
import Flake0 from "src/assets/img/snow/flake-0.png"
import Flake1 from "src/assets/img/snow/flake-1.png"
import Flake2 from "src/assets/img/snow/flake-2.png"

import Particles from "../Particles"
import { ParticleProps } from "../Particles/Particles"

import { StyledFlake } from "./styled-components"

export const NUM_FLAKES = 100

const FLAKE_IMAGES: string[] = [Flake0, Flake1, Flake2]

const NUM_FLAKE_TYPES = FLAKE_IMAGES.length

export interface Props {
  scriptRunId: string
}

const Flake: FC<ParticleProps> = ({ particleType }) => (
  <StyledFlake src={FLAKE_IMAGES[particleType]} />
)

const Snow: FC<Props> = function Snow({ scriptRunId }) {
  // Keys should be unique each time, so React replaces the images in the DOM and their animations
  // actually rerun.
  return (
    <Particles
      className="snow"
      scriptRunId={scriptRunId}
      numParticleTypes={NUM_FLAKE_TYPES}
      numParticles={NUM_FLAKES}
      ParticleComponent={Flake}
    />
  )
}

export default memo(Snow)
