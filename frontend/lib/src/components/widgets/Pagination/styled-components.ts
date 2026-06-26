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

interface StyledPaginationContainerProps {
  shouldStretch: boolean
}

export const StyledPaginationContainer =
  styled.div<StyledPaginationContainerProps>(({ shouldStretch }) => ({
    display: "flex",
    justifyContent: shouldStretch ? "center" : "flex-start",
    width: "100%",
  }))

export const StyledPaginationButtonGroup = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.twoXS,
  overflow: "hidden",
}))

interface StyledPaginationButtonProps {
  isSelected?: boolean
}

export const StyledPaginationButton =
  styled.button<StyledPaginationButtonProps>(
    ({ theme, isSelected, disabled }) => ({
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: theme.spacing.threeXL,
      height: theme.spacing.threeXL,
      padding: `0 ${theme.spacing.sm}`,
      border: "none",
      borderRadius: theme.radii.default,
      backgroundColor: isSelected
        ? theme.colors.darkenedBgMix25
        : theme.colors.transparent,
      color: disabled ? theme.colors.fadedText40 : theme.colors.bodyText,
      cursor: disabled ? "not-allowed" : "pointer",
      fontSize: theme.fontSizes.sm,
      fontFamily: theme.fonts.sansSerif,
      fontWeight: theme.fontWeights.normal,
      transition: "background-color 0.15s ease",
      lineHeight: theme.lineHeights.none,

      "&:hover:not(:disabled)": {
        backgroundColor: isSelected
          ? theme.colors.darkenedBgMix40
          : theme.colors.darkenedBgMix25,
      },

      "&:focus-visible": {
        outline: "none",
        boxShadow: theme.shadows.focusRing,
      },

      "&:disabled": {
        cursor: "not-allowed",
        opacity: 0.5,
      },
    })
  )

/**
 * Non-interactive ellipsis indicator that shares the page button's sizing and
 * typography, but omits the button background, border radius, and interactive
 * states since it's a plain span rather than a button.
 */
export const StyledEllipsis = styled.span(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: theme.spacing.threeXL,
  height: theme.spacing.threeXL,
  padding: `0 ${theme.spacing.sm}`,
  backgroundColor: theme.colors.transparent,
  color: theme.colors.fadedText40,
  fontSize: theme.fontSizes.sm,
  fontFamily: theme.fonts.sansSerif,
  fontWeight: theme.fontWeights.normal,
  lineHeight: theme.lineHeights.none,
}))

export const StyledArrowButton = styled.button(({ theme, disabled }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: theme.spacing.threeXL,
  height: theme.spacing.threeXL,
  padding: theme.spacing.none,
  border: "none",
  borderRadius: theme.radii.default,
  backgroundColor: theme.colors.transparent,
  color: disabled ? theme.colors.fadedText40 : theme.colors.bodyText,
  cursor: disabled ? "not-allowed" : "pointer",
  transition: "background-color 0.15s ease",

  "&:hover:not(:disabled)": {
    backgroundColor: theme.colors.darkenedBgMix25,
  },

  "&:focus-visible": {
    outline: "none",
    boxShadow: theme.shadows.focusRing,
  },

  "&:disabled": {
    opacity: 0.5,
  },
}))
