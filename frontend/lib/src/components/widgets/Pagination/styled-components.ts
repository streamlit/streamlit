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
    width: containerWidth ? "100%" : "auto",
    minWidth: 0,
  }))

export const StyledPaginationControls = styled.div(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  flexWrap: "nowrap",
  gap: theme.spacing.twoXS,
  maxWidth: "100%",
  overflow: "hidden",
}))

interface StyledPaginationButtonProps {
  isSelected?: boolean
}

export const StyledPaginationButton =
  styled.button<StyledPaginationButtonProps>(({ isSelected, theme }) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    minWidth: theme.sizes.minElementHeight,
    height: theme.sizes.minElementHeight,
    padding: `${theme.spacing.none} ${theme.spacing.sm}`,
    margin: theme.spacing.none,
    borderRadius: theme.radii.button,
    border: `${theme.sizes.borderWidth} solid ${
      isSelected ? theme.colors.primary : theme.colors.borderColor
    }`,
    backgroundColor: isSelected ? theme.colors.primary : theme.colors.bgColor,
    color: isSelected ? theme.colors.white : theme.colors.bodyText,
    cursor: "pointer",
    userSelect: "none",

    "&:hover:not(:disabled)": {
      borderColor: theme.colors.primary,
    },
    "&:focus": {
      outline: "none",
    },
    "&:focus-visible": {
      boxShadow: theme.shadows.focusRing,
    },
    "&:disabled": {
      backgroundColor: isSelected
        ? theme.colors.fadedText10
        : theme.colors.transparent,
      borderColor: theme.colors.borderColor,
      color: isSelected ? theme.colors.fadedText60 : theme.colors.fadedText40,
      cursor: "not-allowed",
    },
  }))

export const StyledPaginationEllipsis = styled.span(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
  minWidth: theme.sizes.minElementHeight,
  height: theme.sizes.minElementHeight,
  color: theme.colors.fadedText60,
  userSelect: "none",
}))
