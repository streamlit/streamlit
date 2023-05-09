/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import { hasLightBackgroundColor } from "src/lib/theme"

export interface StyledDeckGlChartProps {
  width: number
  height: number
}

export const StyledDeckGlChart = styled.div<StyledDeckGlChartProps>(
  ({ width, height, theme }) => ({
    marginTop: theme.spacing.sm,
    position: "relative",
    height,
    width,
  })
)

export const StyledNavigationControlContainer = styled.div(({ theme }) => ({
  position: "absolute",
  right: "2.625rem",
  top: theme.spacing.md,
  zIndex: 1,

  // Update zoom buttons based on the active theme
  "button:not(:disabled)": {
    background: theme.colors.bgColor,

    // Add a separator between buttons
    "& + button": {
      borderTopColor: theme.colors.secondaryBg,
    },

    // On dark backgrounds, invert the color for the + and - symbols
    "& span": {
      filter: hasLightBackgroundColor(theme) ? "" : "invert(100%)",
    },
  },
}))
