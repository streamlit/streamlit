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
  $squareTopCorners?: boolean
}

export const StyledProgressTrack = styled.div<StyledProgressTrackProps>(
  ({ theme, $size, $squareTopCorners }) => ({
    height: $size === Size.EXTRASMALL ? theme.spacing.twoXS : theme.spacing.sm,
    backgroundColor: theme.colors.secondaryBg,
    borderRadius: theme.radii.sm,
    overflow: "hidden",
    ...($squareTopCorners
      ? { borderTopLeftRadius: 0, borderTopRightRadius: 0 }
      : {}),
  })
)

/**
 * The fill element of the progress bar.
 *
 * `transform` is intentionally NOT in this class — it is applied via inline
 * style in ProgressBar.tsx. Emotion generates a new class for each unique prop
 * combination, so if transform lived here, the browser would see a class swap
 * rather than a property mutation, and the CSS transition would never fire.
 */
export const StyledProgressFill = styled.div(({ theme }) => ({
  width: "100%",
  height: "100%",
  backgroundColor: theme.colors.secondary,
  borderRadius: theme.radii.sm,
  transition: "transform 0.5s ease",
}))
