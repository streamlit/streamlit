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
import { Popover as RAPopover } from "react-aria-components"

import { getOverlayZIndex } from "~lib/components/shared/Base/styled-components"
import { hasLightBackgroundColor } from "~lib/theme/getColors"

export const StyledPopoverBody = styled(RAPopover)<{
  $stretchWidth?: boolean
  $calculatedWidth?: number
}>(({ theme, $stretchWidth, $calculatedWidth = 0 }) => {
  const isLight = hasLightBackgroundColor(theme)
  return {
    boxSizing: "border-box",
    borderRadius: theme.radii.xl,
    border: `${theme.sizes.borderWidth} solid ${isLight ? theme.colors.bgColor : theme.colors.borderColor}`,
    boxShadow: isLight ? theme.shadows.popover : theme.shadows.none,
    padding: `calc(${theme.spacing.twoXL} - ${theme.sizes.borderWidth})`,
    maxHeight: "70vh",
    overflow: "auto",
    maxWidth: `calc(${theme.sizes.contentMaxWidth} - 2 * ${theme.spacing.lg})`,
    minWidth: $stretchWidth
      ? `max(${$calculatedWidth}px, 10rem)`
      : theme.sizes.minPopupWidth,
    backgroundColor: theme.colors.bgColor,
    zIndex: getOverlayZIndex(theme),
    [`@media (max-width: ${theme.breakpoints.sm})`]: {
      maxWidth: `calc(100% - ${theme.spacing.threeXL})`,
    },
  }
})

export const StyledPopoverLabelContainer = styled.div<{
  $hideChevron?: boolean
}>(({ theme, $hideChevron }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.threeXS,
  // The SVG icon we are using seems to have an internal padding of around 25%.
  // Only apply when the chevron is visible.
  marginRight: $hideChevron ? 0 : `calc(-${theme.iconSizes.lg} * 0.25)`,
}))

export const StyledPopoverExpansionIcon = styled.div(({ theme }) => ({
  display: "inline-flex",
  // Small hack to better align the expansion icon with the label.
  marginTop: theme.spacing.threeXS,
}))
