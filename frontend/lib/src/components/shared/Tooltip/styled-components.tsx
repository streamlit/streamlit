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

import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"

import { hasLightBackgroundColor } from "~lib/theme/getColors"

const tooltipFadeIn = keyframes`
  from { opacity: 0 }
  to   { opacity: 1 }
`

// Fixed positioning is the pre-measurement fallback. Floating UI's inline
// styles (also fixed, plus a translate) override top/left once the tooltip
// has been measured. Leave the width shrink-to-fit: a max-content width
// would let the narrow-screen max-width percentage grow past the viewport
// instead of wrapping long help text. pointer-events stay off here so the
// positioning box does not block the page; the content wrapper turns them
// back on.
export const StyledTooltip = styled.div(({ theme }) => ({
  position: "fixed",
  top: 0,
  left: 0,
  zIndex: theme.zIndices.popup,
  pointerEvents: "none",
}))

export const StyledWrapper = styled.div({
  display: "table",
  tableLayout: "fixed",
  width: "100%",
})

export const StyledEllipsizedDiv = styled.div({
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  display: "table-cell",
})

export const StyledTooltipContentWrapper = styled.div(({ theme }) => ({
  boxSizing: "border-box",
  pointerEvents: "auto",
  backgroundColor: hasLightBackgroundColor(theme)
    ? theme.colors.bgColor
    : theme.colors.secondaryBg,
  color: theme.colors.bodyText,
  fontSize: theme.fontSizes.sm,
  fontWeight: theme.fontWeights.normal,
  borderRadius: theme.radii.default,
  boxShadow: theme.shadows.tooltip,
  maxWidth: `calc(${theme.sizes.contentMaxWidth} - 2 * ${theme.spacing.threeXL})`,
  maxHeight: theme.sizes.maxTooltipHeight,
  overflow: "auto",
  padding: `${theme.spacing.xs} ${theme.spacing.md}`,

  animation: `${tooltipFadeIn} 120ms ease-in 50ms both`,

  [`@media (max-width: ${theme.breakpoints.sm})`]: {
    maxWidth: `calc(100% - ${theme.spacing.threeXL})`,
  },
  img: {
    maxWidth: "100%",
  },
  "*": {
    fontSize: theme.fontSizes.sm,
  },
}))
