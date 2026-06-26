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
  getOverlayZIndex,
  getPopoverContainerStyle,
} from "~lib/components/shared/Base/styled-components"

/**
 * Wrapper div that gives floating-ui a measurable bounding rect for sub-menu
 * positioning. Must not use display:contents (produces a zero-size rect).
 * role="presentation" keeps the ARIA menu tree valid (role="menu" → role="menuitem"
 * must not have non-presentation elements between them).
 */
export const StyledSubMenuAnchor = styled.div({})

/**
 * Portal panel wrapper for the ColumnMenu content.
 * position/top/left/transform are set by floatingStyles at render time.
 */
export const StyledColumnMenuPanel = styled.div(({ theme }) => ({
  ...getPopoverContainerStyle(theme),
  zIndex: getOverlayZIndex(theme),
  backgroundColor: theme.colors.bgColor,
  color: theme.colors.bodyText,
  fontSize: theme.fontSizes.sm,
  fontWeight: theme.fontWeights.normal,
  overflow: "auto",
}))

/**
 * Portal panel wrapper shared by FormattingMenu and StatisticsMenu.
 * position/top/left/transform are set by floatingStyles at render time.
 */
export const StyledSubMenuPanel = styled.div(({ theme }) => ({
  ...getPopoverContainerStyle(theme),
  zIndex: getOverlayZIndex(theme),
  backgroundColor: theme.colors.bgColor,
  color: theme.colors.bodyText,
  fontSize: theme.fontSizes.sm,
  fontWeight: theme.fontWeights.normal,
}))

/**
 * A styled menu list component used by the column menu.
 */
export const StyledMenuList = styled.div(({ theme }) => ({
  paddingTop: theme.spacing.threeXS,
  paddingBottom: theme.spacing.threeXS,
  paddingLeft: theme.spacing.xs,
  paddingRight: theme.spacing.xs,
  maxWidth: "10rem",
}))

interface StyledMenuListItemProps {
  isActive?: boolean
  hasSubmenu?: boolean
}
/**
 * A styled menu list item component used by the column menu.
 */
export const StyledMenuListItem = styled.div<StyledMenuListItemProps>(
  ({ theme, isActive, hasSubmenu }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.twoXS,
    marginBottom: theme.spacing.twoXS,
    // Inner padding for content
    paddingLeft: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
    paddingTop: theme.spacing.threeXS,
    paddingBottom: theme.spacing.threeXS,
    cursor: "pointer",
    borderRadius: theme.radii.md2,
    // Use md2 radius to match dropdown items
    backgroundColor: isActive ? theme.colors.darkenedBgMix15 : "transparent",
    "&:hover": {
      backgroundColor: theme.colors.darkenedBgMix15,
    },
    // Focus styling: remove default outline, use theme focus ring for keyboard navigation
    "&:focus": {
      outline: "none",
    },
    "&:focus-visible": {
      boxShadow: theme.shadows.focusRing,
    },
    minWidth: theme.sizes.minMenuWidth,
    // If the submenu is activated, we need to place the menu icon & label to the left
    // and the submenu indicator to the right:
    ...(hasSubmenu && {
      justifyContent: "space-between",
      "& > :first-of-type": {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing.sm,
      },
    }),
  })
)

/**
 * A styled menu divider used by the column menu.
 */
export const StyledMenuDivider = styled.div(({ theme }) => ({
  height: theme.sizes.borderWidth,
  backgroundColor: theme.colors.borderColor,
  marginTop: theme.spacing.xs,
  marginBottom: theme.spacing.xs,
  // Match the horizontal inset of menu items
  marginLeft: theme.spacing.xs,
  // Right margin accounts for scrollbar gutter when present
  marginRight: `max(0px, calc(${theme.spacing.xs} - var(--scrollbar-gutter-size, 0px)))`,
}))

export const StyledColumnHeaderRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: `${theme.spacing.twoXS} ${theme.spacing.none}`,
  cursor: "default",
  gap: theme.spacing.twoXS,
}))

export const StyledTypeIconContainer = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing.twoXS,
  border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
  borderRadius: theme.radii.md2,
  backgroundColor: "transparent",
  color: theme.colors.bodyText,
  height: "fit-content",
}))

export const StyledColumnNameWithIcon = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexGrow: 1,
  padding: `${theme.spacing.threeXS} ${theme.spacing.threeXS}`,
  border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
  borderRadius: theme.radii.md2,
  backgroundColor: theme.colors.secondaryBg,
  minWidth: 0,
  overflow: "hidden",
}))

export const StyledColumnNameText = styled.span(({ theme }) => ({
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  margin: `0 ${theme.spacing.xs}`,
  fontSize: theme.fontSizes.twoSm,
}))

export const StyledIconButton = styled.button(({ theme }) => ({
  background: "none",
  border: "none",
  padding: theme.spacing.twoXS,
  cursor: "pointer",
  color: theme.colors.bodyText,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: theme.radii.sm,
  transition: "background-color 0.2s ease",
  "&:hover": {
    backgroundColor: theme.colors.fadedText05,
  },
  "&:active": {
    backgroundColor: theme.colors.fadedText10,
  },
}))

/**
 * Container for the statistics panel.
 */
export const StyledStatisticsContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.sm,
  padding: theme.spacing.sm,
  minWidth: "13rem",
  maxWidth: "16rem",
}))

/**
 * Height of the statistics chart in rem.
 * Corresponds to CHART_HEIGHT (64px) in StatisticsChart.tsx.
 */
const STATISTICS_CHART_HEIGHT = "4rem"

/**
 * Container for the statistics chart.
 */
export const StyledStatisticsChart = styled.div(({ theme }) => ({
  width: "100%",
  height: STATISTICS_CHART_HEIGHT,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: theme.radii.md2,
  overflow: "hidden",
  "& svg": {
    width: "100%",
  },
}))

/**
 * Container for compact labeled bar charts used by categorical statistics.
 */
export const StyledStatisticsBarChart = styled.div(({ theme }) => ({
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.twoXS,
  fontSize: theme.fontSizes.twoSm,
  lineHeight: theme.lineHeights.base,
}))

/**
 * A labeled row in a compact statistics bar chart.
 *
 * The label and value columns use fixed widths (not `auto`) so every row shares
 * the same track geometry. Otherwise each row is an independent grid and a
 * shorter value (e.g. "6.4%" vs "40.2%") would widen its track, making the bars
 * non-comparable across rows.
 */
export const StyledStatisticsBarRow = styled.div(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "6rem minmax(2.5rem, 1fr) 2.75rem",
  alignItems: "center",
  gap: theme.spacing.twoXS,
  minWidth: 0,
}))

/**
 * Text label for a compact statistics bar row.
 */
export const StyledStatisticsBarLabel = styled.span(({ theme }) => ({
  color: theme.colors.fadedText60,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
}))

/**
 * Track behind a compact statistics bar.
 */
export const StyledStatisticsBarTrack = styled.div(({ theme }) => ({
  height: theme.spacing.sm,
  backgroundColor: theme.colors.fadedText10,
  borderRadius: theme.radii.sm,
  overflow: "hidden",
}))

/**
 * Filled bar in a compact statistics bar row.
 */
export const StyledStatisticsBarFill = styled.div(({ theme }) => ({
  height: "100%",
  backgroundColor:
    theme.colors.chartCategoricalColors[0] ?? theme.colors.primary,
  borderRadius: "inherit",
}))

/**
 * Numeric value for a compact statistics bar row.
 */
export const StyledStatisticsBarValue = styled.span(({ theme }) => ({
  color: theme.colors.bodyText,
  fontWeight: theme.fontWeights.normal,
  textAlign: "right",
  whiteSpace: "nowrap",
}))

/**
 * A subtle full-bleed divider separating the distribution chart from the
 * metrics list. Negative horizontal margins cancel the container padding so the
 * rule spans the full panel width.
 */
export const StyledStatisticsDivider = styled.div(({ theme }) => ({
  height: theme.sizes.borderWidth,
  backgroundColor: theme.colors.borderColor,
  marginLeft: `-${theme.spacing.sm}`,
  marginRight: `-${theme.spacing.sm}`,
}))

/**
 * Container for statistics metrics using semantic description list.
 */
export const StyledStatisticsMetrics = styled.dl(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.twoXS,
  margin: 0,
}))

/**
 * A row in the statistics metrics display.
 */
export const StyledStatisticsRow = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: theme.spacing.md,
  fontSize: theme.fontSizes.twoSm,
  lineHeight: theme.lineHeights.base,
}))

/**
 * Label for a statistics metric (description term).
 */
export const StyledStatisticsLabel = styled.dt(({ theme }) => ({
  color: theme.colors.fadedText60,
  whiteSpace: "nowrap",
  fontWeight: "normal",
}))

/**
 * Value for a statistics metric (description details).
 */
export const StyledStatisticsValue = styled.dd(({ theme }) => ({
  color: theme.colors.bodyText,
  fontWeight: theme.fontWeights.normal,
  textAlign: "right",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: "8rem",
  margin: 0,
}))

/**
 * Empty state message for statistics.
 */
export const StyledStatisticsEmpty = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing.lg,
  color: theme.colors.fadedText60,
  fontSize: theme.fontSizes.sm,
  minWidth: "10rem",
}))

/**
 * Note text for statistics (e.g., "Based on sample").
 */
export const StyledStatisticsNote = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.twoSm,
  color: theme.colors.fadedText40,
  textAlign: "center",
  paddingTop: theme.spacing.twoXS,
}))
