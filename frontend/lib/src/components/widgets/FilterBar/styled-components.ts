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
  getOverlayZIndex,
  getPopoverContainerStyle,
} from "~lib/components/shared/Base/styled-components"

export const StyledFilterBarContainer = styled.div(() => ({
  display: "flex",
  flexDirection: "column" as const,
  width: "100%",
}))

export const StyledPillRow = styled.div(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap" as const,
  gap: theme.spacing.xs,
  alignItems: "center",
}))

export const StyledFilterPill = styled.button<{
  $isActive: boolean
  $isOpen: boolean
}>(({ theme, $isActive, $isOpen }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing.threeXS,
  padding: `${theme.spacing.twoXS} ${theme.spacing.sm}`,
  borderRadius: theme.radii.full,
  border: `${theme.sizes.borderWidth} solid ${
    $isActive ? theme.colors.primary : theme.colors.fadedText20
  }`,
  backgroundColor: $isActive
    ? transparentize(theme.colors.primary, 0.8)
    : "transparent",
  color: $isActive ? theme.colors.primary : theme.colors.bodyText,
  fontSize: theme.fontSizes.twoSm,
  lineHeight: theme.lineHeights.base,
  cursor: "pointer",
  transition: "background 100ms ease, border-color 100ms ease",
  outline: "none",
  whiteSpace: "nowrap" as const,
  maxWidth: "13rem",

  "&:hover:not(:disabled)": {
    backgroundColor: $isActive
      ? transparentize(theme.colors.primary, 0.5)
      : theme.colors.darkenedBgMix15,
    borderColor: $isActive ? theme.colors.primary : theme.colors.fadedText40,
  },

  "&:focus-visible": {
    boxShadow: theme.shadows.focusRing,
  },

  ...($isOpen && {
    backgroundColor: $isActive
      ? transparentize(theme.colors.primary, 0.5)
      : theme.colors.darkenedBgMix15,
    borderColor: $isActive ? theme.colors.primary : theme.colors.fadedText40,
  }),

  "&:disabled": {
    cursor: "default",
    opacity: 0.5,
  },
}))

export const StyledPillContent = styled.span({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap" as const,
})

export const StyledPillLabel = styled.span(({ theme }) => ({
  fontWeight: theme.fontWeights.bold,
}))

export const StyledPillChevron = styled.span(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
  marginLeft: theme.spacing.threeXS,
  opacity: 0.85,
}))

export const StyledAddFilterButton = styled.button(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing.threeXS,
  padding: `${theme.spacing.twoXS} ${theme.spacing.sm}`,
  borderRadius: theme.radii.full,
  border: `${theme.sizes.borderWidth} solid ${theme.colors.fadedText20}`,
  backgroundColor: theme.colors.secondaryBg,
  fontSize: theme.fontSizes.twoSm,
  lineHeight: theme.lineHeights.base,
  cursor: "pointer",
  color: theme.colors.fadedText60,
  transition: "background 100ms ease, border-color 100ms ease",
  outline: "none",

  "&:hover": {
    backgroundColor: theme.colors.darkenedBgMix15,
    borderColor: theme.colors.fadedText40,
    color: theme.colors.bodyText,
  },

  "&:focus-visible": {
    boxShadow: theme.shadows.focusRing,
  },
}))

export const StyledPopoverContainer = styled.div(({ theme }) => ({
  ...getPopoverContainerStyle(theme),
  backgroundColor: theme.colors.bgColor,
  borderRadius: theme.radii.xl,
  maxHeight: "70vh",
  overflow: "auto",
  zIndex: getOverlayZIndex(theme),
  padding: theme.spacing.sm,
  minWidth: "14rem",
}))

export const StyledColumnPickerSearch = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.xs,
  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
  marginBottom: theme.spacing.xs,
  borderBottom: `${theme.sizes.borderWidth} solid ${theme.colors.fadedText10}`,
}))

export const StyledColumnPickerSearchIcon = styled.span(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  color: theme.colors.fadedText40,
  flexShrink: 0,
}))

export const StyledColumnPickerSearchInput = styled.input(({ theme }) => ({
  border: "none",
  outline: "none",
  background: "transparent",
  fontSize: theme.fontSizes.sm,
  color: theme.colors.bodyText,
  width: "100%",
  padding: 0,

  "&::placeholder": {
    color: theme.colors.fadedText40,
  },
}))

export const StyledColumnPickerItem = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.sm,
  height: theme.sizes.elementHighlightHeight,
  paddingLeft: theme.spacing.sm,
  paddingRight: theme.spacing.sm,
  borderRadius: theme.radii.md2,
  cursor: "pointer",
  fontSize: theme.fontSizes.sm,
  transition: "background 50ms ease",

  "&:hover": {
    background: theme.colors.darkenedBgMix15,
  },
}))

export const StyledColumnPickerIcon = styled.span(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: theme.iconSizes.lg,
  color: theme.colors.fadedText60,
}))

export const StyledFilterHeader = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: theme.spacing.xs,
  marginBottom: theme.spacing.sm,
  paddingBottom: theme.spacing.xs,
  borderBottom: `${theme.sizes.borderWidth} solid ${theme.colors.fadedText10}`,
}))

export const StyledFilterHeaderLeft = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.xs,
  minWidth: 0,
}))

export const StyledFilterHeaderTitle = styled.span(({ theme }) => ({
  fontWeight: theme.fontWeights.bold,
  color: theme.colors.fadedText60,
  fontSize: theme.fontSizes.twoSm,
}))

export const StyledFilterDeleteButton = styled.button(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: theme.spacing.twoXS,
  color: theme.colors.fadedText60,
  borderRadius: theme.radii.default,
  lineHeight: theme.lineHeights.none,

  "&:hover": {
    background: theme.colors.darkenedBgMix15,
    color: theme.colors.bodyText,
  },
}))

export const StyledSearchInput = styled.input(({ theme }) => ({
  width: "100%",
  padding: theme.spacing.xs,
  marginBottom: theme.spacing.sm,
  border: `${theme.sizes.borderWidth} solid ${theme.colors.fadedText20}`,
  borderRadius: theme.radii.default,
  fontSize: theme.fontSizes.sm,
  backgroundColor: theme.colors.secondaryBg,
  color: theme.colors.bodyText,
  outline: "none",

  "&:focus": {
    borderColor: theme.colors.primary,
    boxShadow: theme.shadows.focusRing,
  },

  "&::placeholder": {
    color: theme.colors.fadedText40,
  },
}))

export const StyledCheckboxItem = styled.label(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.sm,
  paddingLeft: theme.spacing.sm,
  paddingRight: theme.spacing.sm,
  paddingTop: theme.spacing.twoXS,
  paddingBottom: theme.spacing.twoXS,
  cursor: "pointer",
  marginBottom: theme.spacing.none,
  marginTop: theme.spacing.none,
  "&:hover": { backgroundColor: theme.colors.darkenedBgMix15 },
  "&:focus-within": { backgroundColor: theme.colors.darkenedBgMix25 },
}))

export const StyledCheckboxInput = styled.input({
  position: "absolute",
  opacity: 0,
  width: 0,
  height: 0,
  margin: 0,
})

export const StyledCheckboxMark = styled.span(({ theme }) => ({
  flexShrink: 0,
  width: theme.sizes.checkbox,
  height: theme.sizes.checkbox,
  borderWidth: theme.sizes.borderWidth,
  borderStyle: "solid",
  borderColor: theme.colors.borderColor,
  borderRadius: theme.radii.sm,
  backgroundColor: theme.colors.lightenedBg05,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background-color 100ms ease, border-color 100ms ease",
  '&[data-checked="true"]': {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  "input:focus-visible + &": {
    boxShadow: theme.shadows.focusRing,
  },
  "& svg": {
    width: "65%",
    height: "65%",
    fill: "none",
    stroke: "white",
    strokeWidth: "2.5px",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },
}))

export const StyledCheckboxLabel = styled.span(({ theme }) => ({
  lineHeight: theme.lineHeights.small,
  color: theme.colors.bodyText,
  fontSize: theme.fontSizes.twoSm,
  fontWeight: theme.fontWeights.normal,
}))

export const StyledCheckboxList = styled.div(({ theme }) => ({
  maxHeight: "12.5rem",
  overflowY: "auto" as const,
  paddingTop: theme.spacing.twoXS,
  paddingBottom: theme.spacing.twoXS,
}))

export const StyledFilterActions = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  gap: theme.spacing.xs,
  paddingTop: theme.spacing.sm,
  paddingLeft: theme.spacing.sm,
  paddingRight: theme.spacing.sm,
  marginTop: theme.spacing.xs,
  borderTop: `${theme.sizes.borderWidth} solid ${theme.colors.fadedText10}`,
}))

export const StyledFilterActionLink = styled.button(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "transparent",
  border: `${theme.sizes.borderWidth} solid ${theme.colors.fadedText20}`,
  cursor: "pointer",
  padding: `${theme.spacing.threeXS} ${theme.spacing.sm}`,
  fontSize: theme.fontSizes.twoSm,
  color: theme.colors.bodyText,
  borderRadius: theme.radii.default,
  transition: "background 50ms ease, border-color 50ms ease",

  "&:hover": {
    backgroundColor: theme.colors.darkenedBgMix15,
    borderColor: theme.colors.fadedText40,
  },

  "&:focus-visible": {
    boxShadow: theme.shadows.focusRing,
  },
}))

export const StyledMiniInput = styled.input(({ theme }) => ({
  height: theme.sizes.minElementHeight,
  padding: `${theme.spacing.twoXS} ${theme.spacing.xs}`,
  border: `${theme.sizes.borderWidth} solid ${theme.colors.fadedText20}`,
  borderRadius: theme.radii.default,
  fontSize: theme.fontSizes.sm,
  backgroundColor: theme.colors.secondaryBg,
  color: theme.colors.bodyText,
  outline: "none",
  width: "100%",

  "&:focus": {
    borderColor: theme.colors.primary,
    boxShadow: theme.shadows.focusRing,
  },

  "&::placeholder": {
    color: theme.colors.fadedText40,
  },
}))

export const StyledRangeRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.xs,
}))

export const StyledRangeSeparator = styled.span(({ theme }) => ({
  color: theme.colors.fadedText60,
  fontSize: theme.fontSizes.sm,
  flexShrink: 0,
}))

export const StyledRelativeDateLabel = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
  color: theme.colors.fadedText60,
  padding: `${theme.spacing.xs} 0`,
  fontStyle: "italic",
}))

export const StyledToggleGroup = styled.div(({ theme }) => ({
  display: "flex",
  gap: theme.spacing.twoXS,
}))

export const StyledToggleOption = styled.button<{ $isSelected: boolean }>(
  ({ theme, $isSelected }) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: `${theme.spacing.twoXS} ${theme.spacing.md}`,
    borderRadius: theme.radii.full,
    border: `${theme.sizes.borderWidth} solid ${
      $isSelected ? theme.colors.primary : theme.colors.fadedText20
    }`,
    backgroundColor: $isSelected
      ? transparentize(theme.colors.primary, 0.85)
      : "transparent",
    color: $isSelected ? theme.colors.primary : theme.colors.bodyText,
    fontSize: theme.fontSizes.sm,
    cursor: "pointer",
    transition: "background 100ms ease, border-color 100ms ease",
    outline: "none",

    "&:hover:not(:disabled)": {
      backgroundColor: $isSelected
        ? transparentize(theme.colors.primary, 0.78)
        : theme.colors.darkenedBgMix15,
    },

    "&:focus-visible": {
      boxShadow: theme.shadows.focusRing,
    },
  })
)

export const StyledEmptyMessage = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
  color: theme.colors.fadedText60,
  padding: theme.spacing.xs,
}))

export const StyledOperatorDropdown = styled.div({
  position: "relative",
  display: "inline-flex",
})

export const StyledOperatorTrigger = styled.button(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing.threeXS,
  padding: `${theme.spacing.threeXS} ${theme.spacing.xs}`,
  border: `${theme.sizes.borderWidth} solid ${theme.colors.fadedText20}`,
  borderRadius: theme.radii.default,
  fontSize: theme.fontSizes.twoSm,
  backgroundColor: theme.colors.secondaryBg,
  color: theme.colors.bodyText,
  outline: "none",
  cursor: "pointer",
  maxWidth: "8rem",
  whiteSpace: "nowrap" as const,
  transition: "background 50ms ease, border-color 50ms ease",

  "&:hover": {
    backgroundColor: theme.colors.darkenedBgMix15,
    borderColor: theme.colors.fadedText40,
  },

  "&:focus-visible": {
    boxShadow: theme.shadows.focusRing,
  },

  "&:disabled": {
    cursor: "default",
    opacity: 0.5,
  },
}))

export const StyledOperatorTriggerChevron = styled.span(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  color: theme.colors.fadedText60,
  flexShrink: 0,
  "& svg": {
    width: theme.fontSizes.sm,
    height: theme.fontSizes.sm,
  },
}))

export const StyledOperatorMenu = styled.div(({ theme }) => ({
  backgroundColor: theme.colors.bgColor,
  border: `${theme.sizes.borderWidth} solid ${theme.colors.fadedText20}`,
  borderRadius: theme.radii.md2,
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
  minWidth: "7rem",
  maxHeight: "15rem",
  overflowY: "auto" as const,
}))

export const StyledOperatorMenuItem = styled.button<{ $isSelected: boolean }>(
  ({ theme, $isSelected }) => ({
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: `${theme.spacing.twoXS} ${theme.spacing.sm}`,
    border: "none",
    background: $isSelected ? theme.colors.darkenedBgMix15 : "transparent",
    color: theme.colors.bodyText,
    fontSize: theme.fontSizes.twoSm,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    textAlign: "left" as const,
    outline: "none",

    "&:hover": {
      background: theme.colors.darkenedBgMix15,
    },

    "&:focus-visible": {
      background: theme.colors.darkenedBgMix25,
    },
  })
)

export const StyledFilterBarHeader = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.xs,
}))

export const StyledActiveCountBadge = styled.span(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: theme.iconSizes.lg,
  height: theme.iconSizes.lg,
  padding: `0 ${theme.spacing.threeXS}`,
  borderRadius: theme.radii.full,
  backgroundColor: theme.colors.primary,
  color: theme.colors.bgColor,
  fontSize: theme.fontSizes.twoSm,
  fontWeight: theme.fontWeights.bold,
  lineHeight: theme.lineHeights.none,
}))

export const StyledDisclosureButton = styled.button(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing.threeXS,
  padding: `${theme.spacing.threeXS} ${theme.spacing.xs}`,
  border: "none",
  backgroundColor: "transparent",
  color: theme.colors.fadedText60,
  cursor: "pointer",
  borderRadius: theme.radii.default,
  outline: "none",
  fontSize: theme.fontSizes.sm,

  "&:hover": {
    backgroundColor: theme.colors.darkenedBgMix15,
    color: theme.colors.bodyText,
  },

  "&:focus-visible": {
    boxShadow: theme.shadows.focusRing,
  },
}))

export const StyledClearAllButton = styled.button(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: `${theme.spacing.twoXS} ${theme.spacing.sm}`,
  borderRadius: theme.radii.full,
  border: "none",
  backgroundColor: "transparent",
  fontSize: theme.fontSizes.twoSm,
  color: theme.colors.fadedText60,
  cursor: "pointer",
  outline: "none",
  whiteSpace: "nowrap" as const,

  "&:hover": {
    color: theme.colors.bodyText,
    backgroundColor: theme.colors.darkenedBgMix15,
  },

  "&:focus-visible": {
    boxShadow: theme.shadows.focusRing,
  },
}))

export const StyledLogicToggle = styled.button<{ $isOr: boolean }>(
  ({ theme, $isOr }) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing.threeXS,
    padding: `${theme.spacing.threeXS} ${theme.spacing.xs}`,
    borderRadius: theme.radii.default,
    border: `${theme.sizes.borderWidth} solid ${
      $isOr ? theme.colors.primary : theme.colors.fadedText20
    }`,
    backgroundColor: $isOr
      ? `color-mix(in srgb, ${theme.colors.primary} 10%, transparent)`
      : "transparent",
    fontSize: theme.fontSizes.twoSm,
    fontWeight: theme.fontWeights.bold,
    color: $isOr ? theme.colors.primary : theme.colors.fadedText60,
    cursor: "pointer",
    outline: "none",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,

    "&:hover": {
      backgroundColor: $isOr
        ? `color-mix(in srgb, ${theme.colors.primary} 15%, transparent)`
        : theme.colors.darkenedBgMix15,
      borderColor: $isOr ? theme.colors.primary : theme.colors.fadedText40,
    },

    "&:focus-visible": {
      boxShadow: theme.shadows.focusRing,
    },
  })
)

export const StyledOrSeparator = styled.span(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  fontSize: theme.fontSizes.twoSm,
  color: theme.colors.fadedText40,
  fontStyle: "italic",
  flexShrink: 0,
  userSelect: "none" as const,
}))
