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
  Checkbox as RACheckbox,
  Switch as RASwitch,
} from "react-aria-components"

import { hasLightBackgroundColor } from "~lib/theme/getColors"
import { LabelVisibilityOptions } from "~lib/util/utils"

export const StyledCheckbox = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  minHeight: theme.sizes.smallElementHeight,
}))

interface StyledContentProps {
  visibility?: LabelVisibilityOptions
}

export const StyledContent = styled.div<StyledContentProps>(
  ({ theme, visibility }) => ({
    display: visibility === LabelVisibilityOptions.Collapsed ? "none" : "flex",
    visibility:
      visibility === LabelVisibilityOptions.Hidden ? "hidden" : "visible",
    verticalAlign: "middle",
    flexDirection: "row",
    alignItems: "center",
    lineHeight: theme.lineHeights.small,
  })
)

/** Wrapper around React Aria Checkbox — handles layout and keyboard-focus background. */
export const StyledCheckboxRoot = styled(RACheckbox)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing.sm,
  marginBottom: 0,
  marginTop: 0,
  cursor: "pointer",
  position: "relative",

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
            : "white",
          strokeWidth: "2.5px",
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
      }
    }
  )

/** Wrapper around React Aria Switch — handles layout for the toggle variant. */
export const StyledSwitchRoot = styled(RASwitch)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing.sm,
  marginBottom: 0,
  marginTop: 0,
  cursor: "pointer",
  position: "relative",

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
      marginTop: theme.spacing.twoXS,
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
