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
  containerWidth: boolean
}

export const StyledPaginationContainer =
  styled.div<StyledPaginationContainerProps>(({ containerWidth }) => ({
    display: "flex",
    justifyContent: containerWidth ? "center" : "flex-start",
    width: containerWidth ? "100%" : "fit-content",
  }))

export const StyledPaginationButtonGroup = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.twoXS,
}))

interface StyledPaginationButtonProps {
  isSelected?: boolean
  isEllipsis?: boolean
}

export const StyledPaginationButton =
  styled.button<StyledPaginationButtonProps>(
    ({ theme, isSelected, isEllipsis, disabled }) => ({
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: theme.spacing.threeXL,
      height: theme.spacing.threeXL,
      padding: `0 ${theme.spacing.sm}`,
      border: isSelected
        ? `1px solid ${theme.colors.borderColor}`
        : "1px solid transparent",
      borderRadius: theme.radii.default,
      backgroundColor: theme.colors.transparent,
      color: disabled ? theme.colors.fadedText40 : theme.colors.bodyText,
      cursor: isEllipsis || disabled ? "default" : "pointer",
      fontSize: theme.fontSizes.sm,
      fontFamily: theme.fonts.sansSerif,
      fontWeight: isSelected
        ? theme.fontWeights.bold
        : theme.fontWeights.normal,
      transition: "border-color 0.15s ease, background-color 0.15s ease",
      lineHeight: theme.lineHeights.none,

      "&:hover:not(:disabled)": isEllipsis
        ? {
            cursor: "default",
          }
        : {
            backgroundColor: theme.colors.darkenedBgMix25,
          },

      "&:focus-visible": {
        outline: "none",
        boxShadow: `0 0 0 2px ${theme.colors.primary}`,
      },

      "&:disabled": {
        cursor: "not-allowed",
        opacity: 0.5,
      },
    })
  )

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
    boxShadow: `0 0 0 2px ${theme.colors.primary}`,
  },

  "&:disabled": {
    opacity: 0.5,
  },
}))
