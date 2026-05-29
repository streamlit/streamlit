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
import { transparentize } from "color2k"
import {
  Tab as RATab,
  TabList as RATabList,
  TabPanel as RATabPanel,
  Tabs as RATabs,
} from "react-aria-components"

import { STALE_STYLES } from "~lib/theme/consts"

interface StyledTabContainerProps {
  isOverflowing: boolean
  width: React.CSSProperties["width"]
  flex: React.CSSProperties["flex"]
}

export const StyledTabContainer = styled.div<StyledTabContainerProps>(
  ({ isOverflowing, width, flex }) => ({
    position: isOverflowing ? "relative" : undefined,
    width: width || undefined,
    flex: flex || undefined,
  })
)

interface StyledScrollArrowProps {
  position: "left" | "right"
}

export const StyledScrollArrow = styled.button<StyledScrollArrowProps>(
  ({ theme, position }) => ({
    position: "absolute",
    top: 0,
    [position]: 0,
    zIndex: theme.zIndices.priority,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: theme.sizes.tabHeight,
    width: theme.spacing.xl,
    padding: 0,
    border: "none",
    cursor: "pointer",
    color: theme.colors.fadedText60,
    background: "transparent",
    // Apply gradient background on the side closest to the content
    backgroundImage:
      position === "right"
        ? `linear-gradient(to right, ${transparentize(
            theme.colors.bgColor,
            1
          )}, ${theme.colors.bgColor} 40%)`
        : `linear-gradient(to left, ${transparentize(
            theme.colors.bgColor,
            1
          )}, ${theme.colors.bgColor} 40%)`,

    "&:hover": {
      color: theme.colors.bodyText,
    },

    "&:focus": {
      outline: "none",
    },

    "&:focus-visible": {
      boxShadow: theme.shadows.focusRing,
    },
  })
)

/** Fills StyledTabContainer. Uses column flex per RAC convention for horizontal tabs. */
export const StyledTabsRoot = styled(RATabs)({
  display: "flex",
  flexDirection: "column",
  width: "100%",
})

/** Tab list strip with bottom border separator. overflow-y: clip (the official RAC
 * recommendation) prevents a Y-scroll container from being created while still
 * allowing the absolutely-positioned SelectionIndicator inside each Tab to be visible,
 * because the indicator is within the tab's own height — not overflowing the tablist.
 *
 * The gray base line is rendered as an ::after pseudo-element (position:absolute,
 * z-index:-1) so that the SelectionIndicator inside each Tab paints on top of it,
 * creating a single integrated line (colored under the active tab, gray elsewhere).
 * Using position:relative + z-index:0 on the tablist creates an explicit stacking
 * context so z-index:-1 on ::after is scoped here, not to the document root. */
export const StyledTabList = styled(RATabList, {
  shouldForwardProp: prop => prop !== "$isStale",
})<{ $isStale: boolean }>(({ theme, $isStale }) => ({
  display: "flex",
  gap: theme.spacing.lg,
  overflowX: "auto",
  overflowY: "clip",
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { display: "none" },
  position: "relative",
  zIndex: 0,
  "::after": {
    content: '""',
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: theme.spacing.threeXS,
    backgroundColor: theme.colors.borderColorLight,
    borderRadius: theme.spacing.threeXS,
    zIndex: -1,
    pointerEvents: "none",
  },
  ...($isStale ? STALE_STYLES : {}),
}))

/** Individual tab button — RAC renders as `<div role="tab">`.
 * position:relative establishes the containing block for the absolutely-positioned
 * SelectionIndicator child. The indicator slides to show which tab is active. */
export const StyledTab = styled(RATab, {
  shouldForwardProp: prop => prop !== "$isStale",
})<{ $isStale: boolean }>(({ theme, $isStale }) => ({
  display: "flex",
  alignItems: "center",
  position: "relative",
  height: theme.sizes.tabHeight,
  whiteSpace: "nowrap",
  padding: 0,
  fontSize: theme.fontSizes.sm,
  background: "transparent",
  color: theme.colors.bodyText,
  cursor: "pointer",
  outline: "none",
  "& .react-aria-SelectionIndicator": {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "100%",
    height: theme.spacing.threeXS,
    backgroundColor: "transparent",
    borderRadius: theme.spacing.threeXS,
    transition: "translate 200ms, background-color 200ms",
    "@media (prefers-reduced-motion: reduce)": {
      transition: "none",
    },
  },
  "&[data-selected]": {
    color: theme.colors.primary,
    "& .react-aria-SelectionIndicator": {
      backgroundColor: theme.colors.primary,
    },
  },
  "&[data-hovered]": { color: theme.colors.primary },
  "&[data-focus-visible]": {
    color: theme.colors.primary,
    boxShadow: theme.shadows.focusRing,
  },
  "&[data-disabled]": { opacity: 0.4, cursor: "default" },
  ...($isStale ? STALE_STYLES : {}),
}))

/** Tab panel content area. Inactive force-mounted panels receive `inert="true"` from
 * RAC (not `hidden`), which prevents interaction but does NOT hide them visually.
 * We explicitly hide [inert] panels so only the active panel is visible.
 * The active panel is focusable (RAC sets tabIndex=0 on role="tabpanel"), so we
 * suppress the default outline and show Streamlit's focus ring for keyboard users. */
export const StyledTabPanel = styled(RATabPanel)(({ theme }) => ({
  paddingTop: theme.spacing.lg,
  outline: "none",
  "&[data-focus-visible]": {
    boxShadow: theme.shadows.focusRing,
  },
  "&[inert]": {
    display: "none",
  },
}))
