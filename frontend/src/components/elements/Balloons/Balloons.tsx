import React, { FC, memo } from "react"

/*
 * IMPORTANT: If you change the asset imports below, make sure they still work if Streamlit is
 * served from a subpath.
 */
import Balloon0 from "src/assets/img/balloons/balloon-0.png"
import Balloon1 from "src/assets/img/balloons/balloon-1.png"
import Balloon2 from "src/assets/img/balloons/balloon-2.png"
import Balloon3 from "src/assets/img/balloons/balloon-3.png"
import Balloon4 from "src/assets/img/balloons/balloon-4.png"
import Balloon5 from "src/assets/img/balloons/balloon-5.png"

import Particles from "../Particles"
import { ParticleProps } from "../Particles/Particles"

import { StyledBalloon } from "./styled-components"

export const NUM_BALLOONS = 30

const BALLOON_IMAGES: string[] = [
  Balloon0,
  Balloon1,
  Balloon2,
  Balloon3,
  Balloon4,
  Balloon5,
]

const NUM_BALLOON_TYPES = BALLOON_IMAGES.length

export interface Props {
  scriptRunId: string
}

const Balloon: FC<ParticleProps> = ({ particleType }) => (
  <StyledBalloon src={BALLOON_IMAGES[particleType]} />
)

const Balloons: FC<Props> = ({ scriptRunId }) => (
  // Keys should be unique each time, so React replaces the images in the DOM and their animations
  // actually rerun.
  <Particles
    className="balloons"
    scriptRunId={scriptRunId}
    numParticleTypes={NUM_BALLOON_TYPES}
    numParticles={NUM_BALLOONS}
    ParticleComponent={Balloon}
  />
)

export default memo(Balloons)
