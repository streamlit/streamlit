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

import React, { useEffect, useMemo, useState } from "react"

import { useTheme } from "@emotion/react"
import {
  AccessibilityNew,
  AccessibleForward,
  DirectionsBike,
  DirectionsRun,
  Pool,
  Rowing,
} from "@emotion-icons/material-outlined"

import newYearsRunning from "@streamlit/app/src/assets/img/fireworks.gif"
import { EmotionTheme } from "@streamlit/lib"

import { StyledAppRunningIcon } from "./styled-components"

const icons = [
  { component: AccessibleForward, name: "accessible-forward" },
  { component: AccessibilityNew, name: "accessibility-new" },
  { component: DirectionsBike, name: "directions-bike" },
  { component: DirectionsRun, name: "directions-run" },
  { component: Pool, name: "pool" },
  { component: Rowing, name: "rowing" },
]

const isNewYears = (): boolean => {
  // Test if current date between 12/31 & 1/06
  const currentDate = new Date()
  const month = currentDate.getMonth()
  const date = currentDate.getDate()
  // Check if Dec 31st
  if (month === 11 && date === 31) return true
  // Check if Jan 1st through 6th
  if (month === 0 && date <= 6) return true
  return false
}

// 200ms is the default transition time for the running man icon
const DEFAULT_SPEED = 200

/**
 * The running indicator icon, either the default running man or the new year's
 * fireworks.
 */
const IconRunning: React.FC = () => {
  const [index, setIndex] = useState(0)
  const theme = useTheme() as EmotionTheme
  const isNewYear = useMemo(() => isNewYears(), [])

  useEffect(() => {
    if (isNewYear) return

    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % icons.length)
    }, DEFAULT_SPEED)
    return () => clearInterval(interval)
  }, [isNewYear])

  const currentIcon = icons[index]
  const IconComponent = currentIcon.component

  return (
    <StyledAppRunningIcon
      isNewYears={isNewYear}
      aria-label="Running..."
      role="img"
      data-testid="stStatusWidgetRunningIcon"
    >
      {isNewYear ? (
        <img
          src={newYearsRunning}
          alt="New Year's Celebration"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
          data-testid="stStatusWidgetNewYearsIcon"
        />
      ) : (
        <IconComponent
          color={theme.colors.fadedText60}
          aria-hidden="true"
          data-testid="stStatusWidgetRunningManIcon"
          style={{
            width: theme.sizes.appRunningMen,
            height: theme.sizes.appRunningMen,
          }}
        />
      )}
    </StyledAppRunningIcon>
  )
}

export default IconRunning
