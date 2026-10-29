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

import type { ComponentSelector } from "@emotion/serialize"
import styled from "@emotion/styled"

import { hasLightBackgroundColor } from "~lib/theme/getColors"

import { getOverlayToolbarTopDistance } from "./overlayToolbarSpacing"

export { TOP_DISTANCE } from "./overlayToolbarSpacing"

/** A styled component usable as a CSS selector in template literals. */
type StyledComponentSelector = ComponentSelector & { toString(): string }

export interface StyledToolbarWrapperProps {
  locked?: boolean
  target?: StyledComponentSelector
}

export const StyledToolbarWrapper = styled.div<StyledToolbarWrapperProps>(
  ({ theme, locked = false, target }) => {
    const topDistance = getOverlayToolbarTopDistance(theme)
    // The shown toolbar overlaps the bottom of the preceding element. Use the
    // same z-index as raised content there (e.g. the selected segmented
    // control option) so the toolbar, which comes later in the DOM, paints on
    // top. Stay below app chrome such as the sticky bottom container.
    const shownZIndex = theme.zIndices.priority
    const shownStyles = {
      // The hidden toolbar overlaps the top of its own element (e.g. the
      // dataframe header). Raise it only once `top` has moved it above the
      // element, so the not-yet-visible toolbar never takes those clicks.
      transition: "opacity 150ms 100ms, top 100ms 100ms, z-index 0ms 200ms",
      opacity: 1,
      top: topDistance,
      zIndex: shownZIndex,
    }
    return {
      padding: `${theme.spacing.sm} 0 ${theme.spacing.sm} ${theme.spacing.sm}`,
      position: "absolute",
      top: locked ? topDistance : "-1rem",
      right: theme.spacing.none,
      transition: "none",
      // Numeric rather than `auto` so the shown state can transition it.
      zIndex: locked ? shownZIndex : 0,
      ...(!locked && {
        opacity: 0,
        "&:active, &:focus-visible, &:hover": shownStyles,
        ...(target && {
          [`${target}:hover &, ${target}:active &, ${target}:focus-visible &`]:
            shownStyles,
        }),
      }),
    }
  }
)

export const StyledToolbar = styled.div(({ theme }) => ({
  color: hasLightBackgroundColor(theme)
    ? theme.colors.fadedText60
    : theme.colors.bodyText,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "flex-end",
  boxShadow: theme.shadows.toolbar,
  borderRadius: theme.radii.default,
  backgroundColor: theme.colors.lightenedBg05,
  width: "fit-content",
  padding: theme.spacing.twoXS,
}))

export const StyledToolbarElementContainer = styled.div<{
  width?: number | string
  height?: number | string
  useContainerWidth: boolean
  topCentered?: boolean
  useContainerHeight?: boolean
}>(({ height, useContainerWidth, topCentered, useContainerHeight }) => ({
  position: "relative",
  height:
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- `height` is `number | string | undefined`; a 0 or empty height counts as unset and skips the explicit-height branch
    useContainerWidth && height
      ? height
      : useContainerHeight === true
        ? (height ?? "100%")
        : "fit-content",
  maxWidth: "100%",
  width: useContainerWidth ? "100%" : "fit-content",
  ...(topCentered === true
    ? {
        display: "flex",
        justifyContent: "center",
      }
    : {}),
}))
