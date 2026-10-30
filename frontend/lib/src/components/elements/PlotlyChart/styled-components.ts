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

import {
  printGraphicFitStyles,
  printWidthCapRules,
} from "~lib/components/shared/printWidthCap"

interface StyledPlotlyChartContainerProps {
  /**
   * Whether the container is size-contained, so the rendered plot can't feed
   * back into its parent's height.
   */
  isSizeContained: boolean
  /**
   * Pixel height of a size-contained container when its parent has no
   * definite height to fill. Without it, the container claims no height of
   * its own and only fills its parent.
   */
  fallbackHeight?: number
}

export const StyledPlotlyChartContainer =
  styled.div<StyledPlotlyChartContainerProps>(
    ({ isSizeContained, fallbackHeight }) => ({
      height: "100%",
      ...(isSizeContained && {
        contain: "size",
        containIntrinsicHeight:
          fallbackHeight === undefined ? "none" : `${fallbackHeight}px`,
      }),
      "@media print": {
        // Plotly writes a pixel width from the on-screen layout. Cap it so a
        // narrower printed page does not spill the plot out of its column.
        ...printWidthCapRules,
        // Print can release the parent's height, for example when a
        // fixed-height horizontal container stacks its children. Contain
        // only the width, so the plot takes the height it rendered at
        // instead of collapsing.
        ...(isSizeContained && { contain: "inline-size" }),
      },
      "& .js-plotly-plot, & .svg-container": {
        "@media print": {
          width: "100% !important",
          maxWidth: "100% !important",
        },
      },
      // Plotly's SVG layers have no viewBox, so a capped width crops the
      // right edge of a plot wider than the printed column instead of
      // scaling it.
      "& .main-svg": printGraphicFitStyles,
    })
  )
