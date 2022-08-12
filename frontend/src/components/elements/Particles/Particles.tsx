import React, { FC, memo } from "react"
import range from "lodash/range"
import classNames from "classnames"

export interface ParticleProps {
  particleType: number
}

export interface Props {
  className: string
  scriptRunId: string
  numParticles: number
  numParticleTypes: number
  ParticleComponent: FC<ParticleProps>
}

const Particles: FC<Props> = ({
  className,
  scriptRunId,
  numParticles,
  numParticleTypes,
  ParticleComponent,
}: Props) => (
  // Keys should be unique each time, so React replaces the images in the DOM and their animations
  // actually rerun.
  <div className={classNames(className, "stHidden")}>
    {range(numParticles).map(i => {
      const randNum = Math.floor(Math.random() * numParticleTypes)

      return <ParticleComponent key={scriptRunId + i} particleType={randNum} />
    })}
  </div>
)

export default memo(Particles)
