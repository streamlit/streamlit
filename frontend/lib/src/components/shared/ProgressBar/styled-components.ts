/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import styled from "@emotion/styled"

import { Size } from "./types"

interface StyledProgressTrackProps {
  $size: Size
}

export const StyledProgressTrack = styled.div<StyledProgressTrackProps>(
  ({ theme, $size }) => ({
    height: $size === Size.EXTRASMALL ? theme.spacing.twoXS : theme.spacing.sm,
    backgroundColor: theme.colors.secondaryBg,
    borderRadius: theme.radii.sm,
    overflow: "hidden",
  })
)

/**
 * The fill element of the progress bar.
 *
 * Dynamic values (`transform` and `squareTopCorners` on the track) are applied
 * via inline `style` props in ProgressBar.tsx rather than Emotion props.
 * Emotion generates a new CSS class for each unique prop combination — inline
 * styles keep the class stable so CSS transitions fire correctly, and make
 * `toHaveStyle` assertions in tests reliable (jsdom does not compute
 * class-based styles from injected `<style>` tags).
 */
export const StyledProgressFill = styled.div(({ theme }) => ({
  width: "100%",
  height: "100%",
  backgroundColor: theme.colors.secondary,
  transition: "transform 0.5s ease",
}))
