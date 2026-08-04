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

import { ComponentType } from "react"

import styled from "@emotion/styled"
import { CalendarDate } from "@internationalized/date"
import { getLuminance, transparentize } from "color2k"
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarHeaderCell,
  CalendarProps,
  DateSegment,
  Group,
  ListBox,
  ListBoxItem,
  Popover,
  RangeCalendar,
  RangeCalendarProps,
  Select,
} from "react-aria-components"

import {
  getBorderColor,
  getOverlayZIndex,
  getPopoverContainerStyle,
} from "~lib/components/shared/Base/styled-components"
import { hasLightBackgroundColor } from "~lib/theme/getColors"

export const StyledDateFieldContainer = styled.div({
  width: "100%",
})

export const StyledDateField = styled("div", {
  shouldForwardProp: (prop: string) => !prop.startsWith("$"),
})<{ $isRange?: boolean }>(({ theme, $isRange }) => ({
  flex: $isRange ? "0 0 auto" : 1,
  minWidth: 0,
  ...($isRange && {
    "&:first-of-type": {
      paddingLeft: `calc(${theme.spacing.sm} + ${theme.sizes.tagMarginInsideBorder})`,
    },
  }),
}))

/** Mirrors TimeInput's StyledTimeInputWrapper for cross-widget consistency. */
export const StyledDateInputWrapper = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  width: "100%",
  height: theme.sizes.minElementHeight,
  borderRadius: theme.radii.default,
  borderWidth: theme.sizes.borderWidth,
  borderStyle: "solid",
  borderColor: getBorderColor(theme.colors, false),
  backgroundColor: theme.colors.secondaryBg,
  cursor: "text",
  fontSize: theme.fontSizes.sm,
  lineHeight: theme.lineHeights.inputWidget,
  "&:focus-within": {
    borderColor: getBorderColor(theme.colors, true),
    outline: "none",
  },
  "&[data-has-error]": {
    borderColor: theme.colors.redTextColor,
    backgroundColor: theme.colors.redBackgroundColor,
    color: theme.colors.redTextColor,
  },
  "&[data-disabled]": {
    color: theme.colors.fadedText40,
    cursor: "not-allowed",
  },
}))

/** Uses RAC `Group` instead of `DateInput` to allow custom segment ordering. */
export const StyledDateFieldInput = styled(Group, {
  shouldForwardProp: (prop: string) => !prop.startsWith("$"),
})<{ $isRange?: boolean }>(({ theme, $isRange }) => ({
  display: "flex",
  alignItems: "center",
  flex: 1,
  minWidth: 0,
  paddingTop: theme.spacing.sm,
  paddingBottom: theme.spacing.sm,
  paddingLeft: $isRange
    ? theme.spacing.none
    : `calc(${theme.spacing.sm} + ${theme.sizes.tagMarginInsideBorder})`,
  paddingRight: $isRange ? theme.spacing.none : theme.spacing.sm,
  outline: "none",
}))

export const StyledDateSegment = styled(DateSegment)(({ theme }) => {
  const isLightPrimary = getLuminance(theme.colors.primary) > 0.5

  return {
    paddingLeft: theme.spacing.threeXS,
    paddingRight: theme.spacing.threeXS,
    borderRadius: theme.radii.sm,
    color: theme.colors.bodyText,
    caretColor: "transparent",
    outline: "none",
    fontWeight: theme.fontWeights.normal,
    whiteSpace: "pre",
    "&[data-type=literal]": {
      color: theme.colors.fadedText60,
      padding: 0,
    },
    "&[data-placeholder]": {
      color: theme.colors.fadedText60,
    },
    // Must come after placeholder so focused contrast always wins.
    "&[data-focused]": {
      backgroundColor: theme.colors.primary,
      color: isLightPrimary ? theme.colors.black : theme.colors.white,
    },
    // Inherit wrapper's color (fadedText40 / redTextColor) instead of bodyText.
    "&[data-disabled]": {
      color: "inherit",
    },
    "[data-has-error] &:not([data-focused])": {
      color: "inherit",
    },
  }
})

export const StyledRangeSeparator = styled.span(({ theme }) => ({
  color: theme.colors.fadedText60,
  paddingLeft: theme.spacing.twoXS,
  paddingRight: theme.spacing.twoXS,
  flexShrink: 0,
  userSelect: "none",
}))

export const StyledErrorIconContainer = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  color: theme.colors.redTextColor,
  marginLeft: "auto",
  paddingLeft: theme.spacing.twoXS,
  paddingRight: `calc(${theme.spacing.sm} + ${theme.sizes.tagMarginInsideBorder})`,
  flexShrink: 0,
}))

/** Matches TimeInput's StyledClearButton. */
export const StyledClearButton = styled.button(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: `0 ${theme.spacing.twoXS}`,
  marginLeft: "auto",
  marginRight: theme.spacing.sm,
  color: theme.colors.grayTextColor,
  flexShrink: 0,
  "&:hover": {
    color: theme.colors.bodyText,
  },
  "&:focus-visible": {
    outline: `${theme.sizes.borderWidth} solid ${theme.colors.primary}`,
    borderRadius: theme.radii.sm,
  },
}))

/* eslint-disable streamlit-custom/no-hardcoded-theme-values */
const visuallyHiddenStyle = {
  position: "absolute" as const,
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap" as const,
  border: 0,
}

export const StyledVisuallyHidden = styled.span(visuallyHiddenStyle)
/* eslint-enable streamlit-custom/no-hardcoded-theme-values */

// ---------------------------------------------------------------------------
// Calendar popover
// ---------------------------------------------------------------------------

export const StyledCalendarPopover = styled.div(({ theme }) => {
  // In the sidebar, bgColor and secondaryBg are swapped (bgColor = sidebar
  // background, secondaryBg = main panel white). Overlays should always use the
  // "main panel" white regardless of which container triggered them.
  const overlayBg = theme.inSidebar
    ? theme.colors.secondaryBg
    : theme.colors.bgColor

  return {
    ...getPopoverContainerStyle(theme),
    backgroundColor: overlayBg,
    zIndex: getOverlayZIndex(theme),
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    ...(hasLightBackgroundColor(theme) && {
      borderWidth: theme.spacing.none,
    }),
  }
})

// Pin generic to single-date mode so styled() doesn't widen onChange to accept arrays.
const TypedCalendar = Calendar as ComponentType<
  CalendarProps<CalendarDate, "single">
>

export const StyledCalendarRoot = styled(TypedCalendar)(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
  minWidth: theme.sizes.dateInputMinWidth,
}))

const TypedRangeCalendar = RangeCalendar as ComponentType<
  RangeCalendarProps<CalendarDate>
>

export const StyledRangeCalendarRoot = styled(TypedRangeCalendar)(
  ({ theme }) => ({
    fontSize: theme.fontSizes.sm,
    minWidth: theme.sizes.dateInputMinWidth,
  })
)

export const StyledCalendarHeader = styled.header(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing.sm,
}))

export const StyledCalendarHeaderPickerGroup = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.threeXS,
}))

export const StyledCalendarHeaderButton = styled(Button)(({ theme }) => ({
  appearance: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: theme.sizes.smallElementHeight,
  height: theme.sizes.smallElementHeight,
  flexShrink: 0,
  border: "none",
  borderRadius: theme.radii.default,
  backgroundColor: "transparent",
  color: theme.colors.bodyText,
  cursor: "pointer",
  "&[data-hovered]": {
    backgroundColor: theme.colors.darkenedBgMix15,
  },
  "&[data-pressed]": {
    backgroundColor: theme.colors.darkenedBgMix25,
  },
  "&[data-focus-visible]": {
    outline: `${theme.sizes.borderWidth} solid ${theme.colors.primary}`,
    outlineOffset: theme.spacing.threeXS,
  },
  "&[data-disabled]": {
    color: theme.colors.fadedText40,
    cursor: "not-allowed",
    backgroundColor: "transparent",
  },
}))

export const StyledCalendarHeaderSelect = styled(Select)({
  position: "relative",
  display: "inline-flex",
  minWidth: 0,
})

export const StyledQuickSelectRow = styled.div(({ theme }) => ({
  position: "relative",
  paddingTop: theme.spacing.xs,
}))

export const StyledQuickSelectLabel = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
  color: theme.colors.fadedText60,
  paddingBottom: theme.spacing.twoXS,
}))

export const StyledQuickSelectTrigger = styled(Button)(({ theme }) => ({
  appearance: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  height: theme.sizes.minElementHeight,
  borderWidth: theme.sizes.borderWidth,
  borderStyle: "solid",
  borderColor: getBorderColor(theme.colors, false),
  borderRadius: theme.radii.default,
  backgroundColor: theme.colors.secondaryBg,
  color: theme.colors.bodyText,
  fontSize: theme.fontSizes.sm,
  paddingLeft: theme.spacing.sm,
  paddingRight: theme.spacing.sm,
  cursor: "pointer",
  "&[data-hovered]": {
    borderColor: getBorderColor(theme.colors, true),
  },
  "&[data-focus-visible]": {
    borderColor: getBorderColor(theme.colors, true),
    outline: "none",
  },
}))

/* eslint-disable streamlit-custom/no-hardcoded-theme-values */
export const StyledQuickSelectListBox = styled(ListBox)(({ theme }) => ({
  outline: "none",
  maxHeight: `min(${theme.sizes.maxDropdownHeight}, 70vh)`,
  overflowY: "auto",
  overflowX: "hidden",
  padding: theme.spacing.threeXS,
  listStyle: "none",
  position: "absolute",
  left: 0,
  right: 0,
  marginTop: theme.spacing.twoXS,
  borderWidth: theme.sizes.borderWidth,
  borderStyle: "solid",
  borderColor: getBorderColor(theme.colors, false),
  borderRadius: theme.radii.default,
  backgroundColor: theme.colors.bgColor,
  boxShadow: `0 4px 16px rgba(0, 0, 0, 0.12)`,
  zIndex: 1,
}))
/* eslint-enable streamlit-custom/no-hardcoded-theme-values */

export const StyledQuickSelectListBoxItem = styled(ListBoxItem)(
  ({ theme }) => ({
    display: "flex",
    alignItems: "center",
    borderRadius: theme.radii.sm,
    padding: `${theme.spacing.twoXS} ${theme.spacing.sm}`,
    cursor: "pointer",
    fontSize: theme.fontSizes.sm,
    color: theme.colors.bodyText,
    outline: "none",
    "&[data-hovered], &[data-focused]": {
      backgroundColor: theme.colors.darkenedBgMix15,
    },
    "&[data-selected]": {
      backgroundColor: theme.colors.darkenedBgMix25,
    },
  })
)

export const StyledCalendarHeaderSelectTrigger = styled(Button)(
  ({ theme }) => ({
    appearance: "none",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.threeXS,
    border: "none",
    borderRadius: theme.radii.sm,
    backgroundColor: "transparent",
    color: theme.colors.bodyText,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.semiBold,
    cursor: "pointer",
    padding: `${theme.spacing.twoXS} ${theme.spacing.twoXS}`,
    maxWidth: "100%",
    "&[data-hovered]": {
      backgroundColor: theme.colors.darkenedBgMix15,
    },
    "&[data-pressed]": {
      backgroundColor: theme.colors.darkenedBgMix25,
    },
    "&[data-focus-visible]": {
      outline: "none",
      boxShadow: `inset 0 0 0 ${theme.sizes.borderWidth} ${theme.colors.primary}`,
    },
  })
)

export const StyledCalendarHeaderSelectChevron = styled.div(({ theme }) => ({
  display: "flex",
  color: theme.colors.fadedText60,
}))

/** Uses RAC's own positioning (not Floating UI) to avoid nesting two
 * positioning engines inside the outer calendar popover. */
export const StyledCalendarHeaderSelectPopover = styled(Popover)(
  ({ theme }) => ({
    ...getPopoverContainerStyle(theme),
    // Same sidebar swap as StyledCalendarPopover — use "main panel" white.
    backgroundColor: theme.inSidebar
      ? theme.colors.secondaryBg
      : theme.colors.bgColor,
    zIndex: getOverlayZIndex(theme),
  })
)

export const StyledCalendarHeaderSelectListBox = styled(ListBox)(
  ({ theme }) => ({
    outline: "none",
    maxHeight: `min(${theme.sizes.maxDropdownHeight}, 70vh)`,
    overflowY: "auto",
    overflowX: "hidden",
    padding: theme.spacing.threeXS,
    listStyle: "none",
    margin: theme.spacing.none,
  })
)

export const StyledCalendarHeaderSelectListBoxItem = styled(ListBoxItem)(
  ({ theme }) => ({
    display: "flex",
    alignItems: "center",
    borderRadius: theme.radii.sm,
    padding: `${theme.spacing.twoXS} ${theme.spacing.sm}`,
    cursor: "pointer",
    fontSize: theme.fontSizes.sm,
    color: theme.colors.bodyText,
    outline: "none",
    "&[data-hovered], &[data-focused]": {
      backgroundColor: theme.colors.darkenedBgMix15,
    },
    "&[data-selected]": {
      backgroundColor: theme.colors.darkenedBgMix25,
    },
  })
)

export const StyledCalendarHeadingFallback = styled.div(visuallyHiddenStyle)

export const StyledCalendarGrid = styled(CalendarGrid)(({ theme }) => ({
  width: "100%",
  borderCollapse: "collapse",
  fontSize: theme.fontSizes.sm,
}))

export const StyledCalendarHeaderCell = styled(CalendarHeaderCell)(
  ({ theme }) => ({
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.semiBold,
    color: theme.colors.bodyText,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  })
)

/**
 * In single mode, `data-selected` draws the solid primary rounded rect.
 * In range mode, `data-selection-start`/`data-selection-end` get the same
 * rounded-rect highlight (via `::after` pseudo) with a tint band extending
 * toward the range interior (via `::before` pseudo). Days between them get
 * a seamless tint band via `data-selected` alone.
 */
export const StyledCalendarCell = styled(CalendarCell, {
  shouldForwardProp: (prop: string) => !prop.startsWith("$"),
})<{ $isRangeMode: boolean }>(({ theme, $isRangeMode }) => {
  const isLightPrimary = getLuminance(theme.colors.primary) > 0.5
  const selectedTextColor = isLightPrimary
    ? theme.colors.black
    : theme.colors.white

  const cellSize = theme.sizes.smallElementHeight
  const primary = theme.colors.primary
  const rangeTint = transparentize(primary, 0.85)
  const radius = theme.radii.default

  const borderWidth = theme.sizes.borderWidth

  // Centered, rounded focus/hover ring drawn via ::after for range cells
  // whose own dimensions (width: auto, borderRadius: 0) differ from the
  // visual cellSize rounded-rect shape. Matches unselected cells' native
  // boxShadow appearance exactly.
  const rangeFocusRing = {
    content: '""',
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: cellSize,
    borderRadius: radius,
    boxShadow: `inset 0 0 0 ${borderWidth} ${primary}`,
    pointerEvents: "none" as const,
  }

  // Shared base for range start/end endpoints: cell fills td, pseudos
  // create the tint band (::before) and primary rounded rect (::after).
  const rangeEndpointBase = {
    width: "auto",
    marginLeft: 0,
    marginRight: 0,
    backgroundColor: "transparent",
    color: selectedTextColor,
    position: "relative" as const,
    isolation: "isolate" as const,
    // Primary rounded rect (same shape as single-mode selected cell)
    "&::after": {
      content: '""',
      position: "absolute" as const,
      top: 0,
      bottom: 0,
      left: "50%",
      transform: "translateX(-50%)",
      width: cellSize,
      borderRadius: radius,
      backgroundColor: primary,
      zIndex: -1,
    },
  }

  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box" as const,
    width: cellSize,
    height: cellSize,
    marginTop: theme.spacing.twoXS,
    marginBottom: theme.spacing.twoXS,
    marginLeft: "auto",
    marginRight: "auto",
    textAlign: "center" as const,
    cursor: "pointer",
    fontSize: theme.fontSizes.sm,
    lineHeight: theme.lineHeights.base,
    borderRadius: radius,
    outline: "none",

    ...($isRangeMode && {
      // In-range days: stretch to fill td for seamless band
      "&[data-selected]:not([data-selection-start]):not([data-selection-end])":
        {
          width: "auto",
          marginLeft: 0,
          marginRight: 0,
          borderRadius: 0,
          backgroundColor: rangeTint,
          position: "relative" as const,
          // Hover/focus: centered rounded ring via ::after
          "&[data-hovered]::after, &[data-focus-visible]::after":
            rangeFocusRing,
        },
      // Start endpoint: tint band on right half, primary rounded rect centered
      "&[data-selection-start]:not([data-selection-end])": {
        ...rangeEndpointBase,
        "&::before": {
          content: '""',
          position: "absolute" as const,
          top: 0,
          bottom: 0,
          left: "50%",
          right: 0,
          backgroundColor: rangeTint,
          zIndex: -2,
        },
        // Focus ring: outline on the ::after (which is already cellSize/rounded)
        "&[data-hovered]::after, &[data-focus-visible]::after": {
          outline: `${borderWidth} solid ${primary}`,
          outlineOffset: `-${borderWidth}`,
        },
      },
      // End endpoint: tint band on left half, primary rounded rect centered
      "&[data-selection-end]:not([data-selection-start])": {
        ...rangeEndpointBase,
        "&::before": {
          content: '""',
          position: "absolute" as const,
          top: 0,
          bottom: 0,
          left: 0,
          right: "50%",
          backgroundColor: rangeTint,
          zIndex: -2,
        },
        // Focus ring: outline on the ::after (which is already cellSize/rounded)
        "&[data-hovered]::after, &[data-focus-visible]::after": {
          outline: `${borderWidth} solid ${primary}`,
          outlineOffset: `-${borderWidth}`,
        },
      },
      // Single-day range: just the rounded rect (same as single mode)
      "&[data-selection-start][data-selection-end]": {
        backgroundColor: primary,
        color: selectedTextColor,
      },
      // Suppress cell-level indicators on all selected range cells —
      // they'd render at td-width with borderRadius:0 (square).
      // The pseudo-element focus rings above handle it correctly.
      "&[data-selected][data-hovered], &[data-selected][data-focus-visible]": {
        boxShadow: "none",
        outline: "none",
      },
    }),

    ...(!$isRangeMode && {
      "&[data-selected]": {
        backgroundColor: primary,
        color: selectedTextColor,
      },
      "&[data-selected][data-focus-visible]": {
        outline: `${theme.sizes.focusOutlineWidth} solid ${primary}`,
        outlineOffset: theme.spacing.threeXS,
      },
    }),

    "&[data-hovered]": {
      boxShadow: `inset 0 0 0 ${borderWidth} ${primary}`,
    },

    "&[data-focus-visible]": {
      boxShadow: `inset 0 0 0 ${borderWidth} ${primary}`,
    },

    "&[data-disabled], &[data-unavailable]": {
      color: theme.colors.fadedText40,
      cursor: "not-allowed",
      boxShadow: "none",
    },

    "&[data-outside-month]": {
      color: theme.colors.fadedText40,
    },
  }
})
