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

import React, { useState } from "react"

import { StyledCountdown } from "./styled-components"

interface Props {
  countdown: number
  endCallback: () => void
}

const Countdown: React.FC<Props> = ({ countdown, endCallback }) => {
  const [currentCountdown, setCurrentCountdown] = useState(countdown)

  const onAnimationEnd = (): void => {
    const newCountdown = currentCountdown - 1

    if (newCountdown >= 0) {
      setCurrentCountdown(newCountdown)
    }

    if (newCountdown === 0) {
      endCallback()
    }
  }

  return (
    <StyledCountdown
      data-testid="stCountdown"
      onAnimationEnd={onAnimationEnd}
      key={`frame${currentCountdown}`}
    >
      {/* The key forces DOM mutations, for animation to restart. */}
      <span>{currentCountdown}</span>
    </StyledCountdown>
  )
}

export default Countdown
