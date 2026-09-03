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

import styled, { CSSObject } from "@emotion/styled"
import {
  CheckboxButton as RACheckboxButton,
  CheckboxField as RACheckboxField,
  SwitchButton as RASwitchButton,
  SwitchField as RASwitchField,
} from "react-aria-components"

import { hasLightBackgroundColor } from "~lib/theme/getColors"
import type { EmotionTheme } from "~lib/theme/types"
import { LabelVisibilityOptions } from "~lib/util/utils"

/**
 * Shared by both field wrappers so checkbox and toggle cannot drift out of
 * alignment with each other.
 */
const fieldStyles = ({ theme }: { theme: EmotionTheme }): CSSObject => ({
  display: "flex",
  alignItems: "center",
  minHeight: theme.sizes.smallElementHeight,
})

/**
 * React Aria field that passes the controlled selection state to
 * `CheckboxButton` and renders the outer wrapper `<div>`. Column alignment CSS,
 * `data-testid="stCheckbox"` and the `stCheckbox` class all target this element.
 */
export const StyledCheckboxField = styled(RACheckboxField)(fieldStyles)

/**
 * The toggle's equivalent of `StyledCheckboxField`, kept separate because
 * `SwitchButton` reads its state from a `SwitchField`, not from a
 * `CheckboxField`. Column alignment CSS and `data-testid="stCheckbox"` target
 * this element too, so checkbox and toggle stay aligned identically.
 */
export const StyledSwitchField = styled(RASwitchField)(fieldStyles)

interface StyledContentProps {
  visibility?: LabelVisibilityOptions
  /** When true, the label truncates on one line, so it must be shrinkable. */
  $truncate?: boolean
}

export const StyledContent = styled.div<StyledContentProps>(
  ({ theme, visibility, $truncate }) => ({
    display: visibility === LabelVisibilityOptions.Collapsed ? "none" : "flex",
    visibility:
      visibility === LabelVisibilityOptions.Hidden ? "hidden" : "visible",
    verticalAlign: "middle",
    flexDirection: "row",
    alignItems: "center",
    lineHeight: theme.lineHeights.small,
    // Allow the label to shrink below its content size so the markdown can
    // ellipsize. The help icon keeps its intrinsic size and stays visible.
    ...($truncate && { minWidth: 0 }),
  })
)

interface StyledLabelTextProps {
  /** When true, the label truncates on one line, so it must be shrinkable. */
  $truncate?: boolean
}

/**
 * Wraps the label markdown so the native `title` tooltip is scoped to the label
 * only (not the sibling help icon). When truncating it becomes a shrinkable flex
 * box so the markdown can ellipsize; otherwise it stays transparent to layout.
 */
export const StyledLabelText = styled.div<StyledLabelTextProps>(
  ({ $truncate }) =>
    $truncate
      ? { display: "flex", alignItems: "center", minWidth: 0 }
      : { display: "contents" }
)

interface StyledButtonProps {
  /** When true, the control can shrink within its container so the label can ellipsize. */
  $truncate?: boolean
}

/** Truncation and keyboard-focus background apply here, not on the Field wrapper. */
export const StyledCheckboxButton = styled(RACheckboxButton, {
  shouldForwardProp: (prop: string) => !prop.startsWith("$"),
})<StyledButtonProps>(({ theme, $truncate }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing.sm,
  marginBottom: 0,
  marginTop: 0,
  cursor: "pointer",
  position: "relative",
  // Bound the control to its container (without expanding a short label to full
  // width) and let it shrink so an overflowing label can ellipsize instead of
  // widening the control past its container.
  ...($truncate && { minWidth: 0, maxWidth: "100%" }),

  "&[data-disabled]": {
    cursor: "not-allowed",
    color: theme.colors.fadedText40,
  },

  "&[data-focus-visible]": {
    backgroundColor: theme.colors.darkenedBgMix25,
  },
}))

interface StyledCheckboxIndicatorProps {
  $isSelected: boolean
  $isFocusVisible: boolean
  $isDisabled: boolean
}

export const StyledCheckboxIndicator =
  styled.div<StyledCheckboxIndicatorProps>(
    ({ theme, $isSelected, $isFocusVisible, $isDisabled }) => {
      let borderColor: string
      let backgroundColor: string

      if ($isDisabled) {
        borderColor = theme.colors.borderColor
        backgroundColor = $isSelected
          ? theme.colors.fadedText40
          : theme.colors.lightenedBg05
      } else if ($isSelected) {
        borderColor = theme.colors.primary
        backgroundColor = theme.colors.primary
      } else {
        borderColor = theme.colors.borderColor
        backgroundColor = theme.colors.lightenedBg05
      }

      return {
        flexShrink: 0,
        width: theme.sizes.checkbox,
        height: theme.sizes.checkbox,
        // Vertically center the indicator with the first text line.
        // = (lineHeight × fontSize − indicatorSize) / 2 = (1.5 × 0.875rem − 1rem) / 2 = 2.5px
        marginTop: `calc((${theme.lineHeights.small} * ${theme.fontSizes.sm} - ${theme.sizes.checkbox}) / 2)`,
        borderRadius: theme.radii.sm,
        border: `${theme.sizes.borderWidth} solid ${borderColor}`,
        backgroundColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow:
          $isFocusVisible && $isSelected ? theme.shadows.focusRing : "none",
        transition: "background-color 100ms ease, border-color 100ms ease",

        "& svg": {
          width: "65%",
          height: "65%",
          fill: "none",
          stroke: $isDisabled
            ? hasLightBackgroundColor(theme)
              ? theme.colors.bgColor
              : theme.colors.bodyText
            : theme.colors.white,
          strokeWidth: "2.5px",
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
      }
    }
  )

/**
 * The toggle's equivalent of `StyledCheckboxButton`: truncation and
 * keyboard-focus background apply here, not on the Field wrapper.
 */
export const StyledSwitchButton = styled(RASwitchButton, {
  shouldForwardProp: (prop: string) => !prop.startsWith("$"),
})<StyledButtonProps>(({ theme, $truncate }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing.sm,
  marginBottom: 0,
  marginTop: 0,
  cursor: "pointer",
  position: "relative",
  // Bound the control to its container (without expanding a short label to full
  // width) and let it shrink so an overflowing label can ellipsize instead of
  // widening the control past its container.
  ...($truncate && { minWidth: 0, maxWidth: "100%" }),

  "&[data-disabled]": {
    cursor: "not-allowed",
    color: theme.colors.fadedText40,
  },

  "&[data-focus-visible]": {
    backgroundColor: theme.colors.darkenedBgMix25,
  },
}))

interface StyledToggleTrackProps {
  $isSelected: boolean
  $isHovered: boolean
  $isDisabled: boolean
}

export const StyledToggleTrack = styled.div<StyledToggleTrackProps>(
  ({ theme, $isSelected, $isHovered, $isDisabled }) => {
    let backgroundColor: string

    if ($isSelected && !$isDisabled) {
      backgroundColor = theme.colors.primary
    } else if ($isHovered && !$isDisabled) {
      backgroundColor = theme.colors.darkenedBgMix15
    } else {
      backgroundColor = theme.colors.borderColor
    }

    return {
      flexShrink: 0,
      // Vertically center the track with the first text line — mirrors the
      // checkbox indicator formula: (lineHeight × fontSize − trackHeight) / 2
      marginTop: `calc((${theme.lineHeights.small} * ${theme.fontSizes.sm} - ${theme.sizes.checkbox}) / 2)`,
      width: `calc(2 * ${theme.sizes.checkbox})`,
      height: theme.sizes.checkbox,
      paddingLeft: theme.spacing.threeXS,
      paddingRight: theme.spacing.threeXS,
      borderRadius: theme.radii.full,
      backgroundColor,
      display: "flex",
      alignItems: "center",
      transition: "background-color 150ms ease",
    }
  }
)

interface StyledToggleThumbProps {
  $isSelected: boolean
  $isDisabled: boolean
}

export const StyledToggleThumb = styled.div<StyledToggleThumbProps>(
  ({ theme, $isSelected, $isDisabled }) => {
    const isLightTheme = hasLightBackgroundColor(theme)
    const backgroundColor = $isDisabled
      ? isLightTheme
        ? theme.colors.gray70
        : theme.colors.gray90
      : isLightTheme
        ? theme.colors.bgColor
        : theme.colors.bodyText

    return {
      flexShrink: 0,
      width: `calc(${theme.sizes.checkbox} - ${theme.spacing.twoXS})`,
      height: `calc(${theme.sizes.checkbox} - ${theme.spacing.twoXS})`,
      borderRadius: theme.radii.full,
      backgroundColor,
      transform: $isSelected
        ? `translateX(${theme.sizes.checkbox})`
        : "translateX(0)",
      transition: "transform 150ms ease",
    }
  }
)
