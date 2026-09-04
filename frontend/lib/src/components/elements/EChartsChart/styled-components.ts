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

/**
 * Outermost chart chrome. Stretch height uses the content-size floor so
 * `height: 100%` does not collapse to 0 outside a sized parent.
 */
export const StyledEChartsChartRoot = styled.div<{
  isStretchHeight?: boolean
}>(({ theme, isStretchHeight }) => ({
  position: "relative",
  width: "100%",
  height: "100%",
  ...(isStretchHeight && { minHeight: theme.sizes.defaultChartHeight }),
}))

/**
 * Fills the root even when the root only has minHeight (percentage height
 * would otherwise compute to auto and leave the chart at 0px).
 */
export const StyledEChartsChartFill = styled.div<{
  isStretchHeight?: boolean
}>(({ isStretchHeight }) =>
  isStretchHeight
    ? {
        position: "absolute",
        inset: 0,
      }
    : {
        width: "100%",
        height: "100%",
      }
)

/**
 * The container that ECharts renders its canvas/SVG into. It fills its parent so
 * ECharts can read valid, non-zero dimensions from the DOM element.
 */
export const StyledEChartsChartContainer = styled.div({
  width: "100%",
  height: "100%",
})

/** Stacks the chart and an in-place render-error overlay at the same size. */
export const StyledEChartsChartStack = styled.div({
  position: "relative",
  width: "100%",
  height: "100%",
})

/**
 * A styled error message shown when an ECharts option cannot be rendered,
 * matching the error styling used by other charts (e.g. Mermaid).
 */
export const StyledEChartsError = styled.div(({ theme }) => ({
  color: theme.colors.redTextColor,
  backgroundColor: theme.colors.redBackgroundColor,
  padding: theme.spacing.sm,
  borderRadius: theme.radii.default,
  fontSize: theme.fontSizes.sm,
  fontFamily: theme.genericFonts.codeFont,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  width: "100%",
}))

/** Covers the chart so a render error does not overflow the element height. */
export const StyledEChartsErrorOverlay = styled(StyledEChartsError)(
  ({ theme }) => ({
    position: "absolute",
    inset: 0,
    overflow: "auto",
    zIndex: theme.zIndices.priority,
  })
)
