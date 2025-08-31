/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { FC, memo, useContext, useMemo } from "react"

import range from "lodash/range"

import { LibContext } from "~lib/components/core/LibContext"

import { StyledParticles } from "./styled-components"
export interface ParticleProps {
  particleType: number
  resourceCrossOriginMode?: undefined | "anonymous" | "use-credentials"
}

export interface Props {
  className: string
  scriptRunId: string
  numParticles: number
  numParticleTypes: number
  ParticleComponent: FC<React.PropsWithChildren<ParticleProps>>
}

const Particles: FC<React.PropsWithChildren<Props>> = ({
  className,
  scriptRunId,
  numParticles,
  numParticleTypes,
  ParticleComponent,
}: Props) => {
  const { libConfig } = useContext(LibContext)

  // Prepare a random selection of particle types:
  const particleTypes = useMemo(
    () =>
      range(numParticles).map(() =>
        Math.floor(Math.random() * numParticleTypes)
      ),
    [numParticles, numParticleTypes]
  )

  return (
    // Keys should be unique each time, so React replaces the images in the DOM and their animations
    // actually rerun.
    <StyledParticles className={className} data-testid={className}>
      {particleTypes.map((particleType, i) => (
        <ParticleComponent
          // eslint-disable-next-line @eslint-react/no-array-index-key
          key={scriptRunId + i}
          particleType={particleType}
          resourceCrossOriginMode={libConfig.resourceCrossOriginMode}
        />
      ))}
    </StyledParticles>
  )
}

export default memo(Particles)
