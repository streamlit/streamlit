/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

export const StyledTagInput = styled.div`
  position: relative;
`

// Visually hidden but accessible to screen readers
export const StyledScreenReaderAnnouncement = styled.div`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`

export interface StyledTagInputContainerProps {
  $isFocused: boolean
  $disabled: boolean
}

export const StyledTagInputContainer =
  styled.div<StyledTagInputContainerProps>(
    ({ theme, $isFocused, $disabled }) => {
      // Use widgetBorderColor for consistency with other Streamlit input widgets
      const defaultBorderColor =
        theme.colors.widgetBorderColor ?? theme.colors.secondaryBg
      const focusedBorderColor = theme.colors.primary
      const disabledBgColor = theme.colors.secondaryBg

      return {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: theme.spacing.xs,
        padding: theme.spacing.sm,
        minHeight: theme.sizes.minElementHeight,
        backgroundColor: $disabled ? disabledBgColor : "transparent",
        borderWidth: theme.sizes.borderWidth,
        borderStyle: "solid",
        borderColor: $isFocused ? focusedBorderColor : defaultBorderColor,
        borderRadius: theme.radii.default,
        cursor: $disabled ? "not-allowed" : "text",
        transitionDuration: "200ms",
        transitionProperty: "border",
        transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.4, 1)",

        "&:hover": {
          borderColor: $disabled
            ? defaultBorderColor
            : $isFocused
              ? focusedBorderColor
              : theme.colors.fadedText20,
        },
      }
    }
  )

// Keyframe animation for highlighting duplicate tags
const highlightPulse = keyframes`
  0% {
    background-color: var(--highlight-color);
    transform: scale(1);
  }
  50% {
    background-color: var(--highlight-color-intense);
    transform: scale(1.05);
  }
  100% {
    background-color: var(--highlight-color);
    transform: scale(1);
  }
`

export interface StyledTagProps {
  $disabled: boolean
  $highlighted?: boolean
}

export const StyledTag = styled.div<StyledTagProps>(
  ({ theme, $disabled, $highlighted }) => ({
    "--highlight-color": theme.colors.darkenedBgMix25,
    "--highlight-color-intense": theme.colors.darkenedBgMix100,
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing.xs,
    padding: `${theme.spacing.threeXS} ${theme.spacing.sm}`,
    backgroundColor: $highlighted
      ? theme.colors.darkenedBgMix25
      : theme.colors.fadedText05,
    borderRadius: theme.radii.md,
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.normal,
    color: $disabled ? theme.colors.fadedText40 : theme.colors.bodyText,
    maxWidth: "100%",
    overflow: "hidden",
    transition: "background-color 0.15s ease, outline 0.15s ease",
    cursor: $disabled ? "not-allowed" : "default",
    outline: "none",
    // Apply highlight animation when tag is highlighted (duplicate rejection)
    animation: $highlighted ? `${highlightPulse} 0.3s ease-in-out 2` : "none",

    "&:focus": {
      outline: `2px solid ${theme.colors.primary}`,
      outlineOffset: "1px",
    },

    "&:focus-visible": {
      outline: `2px solid ${theme.colors.primary}`,
      outlineOffset: "1px",
    },
  })
)

export const StyledTagText = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export interface StyledTagRemoveButtonProps {
  $disabled: boolean
}

export const StyledTagRemoveButton = styled.button<StyledTagRemoveButtonProps>(
  ({ theme, $disabled }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: $disabled ? "not-allowed" : "pointer",
    color: $disabled ? theme.colors.fadedText40 : theme.colors.fadedText60,
    borderRadius: theme.radii.full,
    width: "1em",
    height: "1em",
    flexShrink: 0,
    transition: "color 0.15s ease, background-color 0.15s ease",

    "&:hover:not(:disabled)": {
      color: theme.colors.bodyText,
      backgroundColor: theme.colors.darkenedBgMix15,
    },

    "&:focus": {
      outline: "none",
      color: theme.colors.primary,
    },

    "&:focus-visible": {
      outline: `2px solid ${theme.colors.primary}`,
      outlineOffset: "1px",
    },

    "&:active:not(:disabled)": {
      color: theme.colors.primary,
    },

    "&:disabled": {
      cursor: "not-allowed",
      color: theme.colors.fadedText40,
    },
  })
)

export const StyledInputWrapper = styled.div`
  flex: 1;
  min-width: 60px;
`

export const StyledInput = styled.input<{ $disabled: boolean }>(
  ({ theme, $disabled }) => ({
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.sansSerif,
    fontWeight: theme.fontWeights.normal,
    color: $disabled ? theme.colors.fadedText40 : theme.colors.bodyText,
    cursor: $disabled ? "not-allowed" : "text",
    padding: 0,
    lineHeight: theme.lineHeights.inputWidget,
    // Ensure input doesn't shrink in Firefox
    // See https://stackoverflow.com/a/33811151
    minWidth: 0,

    "&::placeholder": {
      color: $disabled ? theme.colors.fadedText40 : theme.colors.fadedText60,
    },

    "&:disabled": {
      cursor: "not-allowed",
      color: theme.colors.fadedText40,
    },
  })
)

export const StyledSuggestionsContainer = styled.div(({ theme }) => ({
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  marginTop: theme.spacing.twoXS,
  backgroundColor: theme.colors.bgColor,
  borderWidth: theme.sizes.borderWidth,
  borderStyle: "solid",
  borderColor: theme.colors.widgetBorderColor ?? theme.colors.secondaryBg,
  borderRadius: theme.radii.default,
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
  zIndex: theme.zIndices.popup,
  maxHeight: "200px",
  overflowY: "auto",
  // Smooth scrolling for keyboard navigation
  scrollBehavior: "smooth",
}))

export interface StyledSuggestionItemProps {
  $isSelected: boolean
}

export const StyledSuggestionItem = styled.div<StyledSuggestionItemProps>(
  ({ theme, $isSelected }) => ({
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    cursor: "pointer",
    backgroundColor: $isSelected
      ? theme.colors.darkenedBgMix15
      : "transparent",
    color: theme.colors.bodyText,
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.sansSerif,
    transition: "background-color 0.1s ease",

    "&:hover": {
      backgroundColor: theme.colors.darkenedBgMix15,
    },

    "&:first-of-type": {
      borderTopLeftRadius: theme.radii.default,
      borderTopRightRadius: theme.radii.default,
    },

    "&:last-of-type": {
      borderBottomLeftRadius: theme.radii.default,
      borderBottomRightRadius: theme.radii.default,
    },
  })
)
