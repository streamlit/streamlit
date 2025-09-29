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

import React, { type KeyboardEvent, memo, type RefObject } from "react"

import styled from "@emotion/styled"

import type { WaveformController } from "~lib/components/audio/core/types"

export interface WaveformSurfaceProps {
  controller: WaveformController
  containerRef: RefObject<HTMLDivElement>
  ariaLabel?: string
  className?: string
}

const StyledWaveformContainer = styled.div(({ theme }) => ({
  position: "relative" as const,
  width: "100%",
  minHeight: "56px",
  backgroundColor: theme.colors.secondaryBg,
  borderRadius: theme.radii.md,
  overflow: "hidden",
  cursor: "pointer",

  "&:focus": {
    outline: `2px solid ${theme.colors.primary}`,
    outlineOffset: "2px",
  },
}))

const WaveformSurface: React.FC<WaveformSurfaceProps> = ({
  controller,
  containerRef,
  ariaLabel = "Recorded audio waveform",
  className,
}) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault()
      if (controller.playback.isPlaying()) {
        controller.playback.pause()
      } else {
        controller.playback.play().catch(() => {})
      }
    }
  }

  return (
    <StyledWaveformContainer
      ref={containerRef}
      className={className}
      aria-label={ariaLabel}
      tabIndex={0}
      role="button"
      onKeyDown={handleKeyDown}
      data-testid="waveform-surface"
    />
  )
}

export default memo(WaveformSurface)
