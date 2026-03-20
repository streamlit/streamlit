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

interface StyledFeedbackContainerProps {
  containerWidth: boolean
}

export const StyledFeedbackContainer =
  styled.div<StyledFeedbackContainerProps>(({ containerWidth }) => ({
    width: containerWidth ? "100%" : "auto",
    // Ensure container expands to fit content even when layout system
    // constrains it with small pixel width (gh-12068)
    minWidth: "fit-content",
  }))

export const StyledFeedbackButtonGroup = styled.div(({ theme }) => ({
  display: "flex",
  flexWrap: "nowrap",
  gap: theme.spacing.threeXS,
  // Ensure buttons don't get squished when container has small pixel width
  minWidth: "fit-content",
}))

interface StyledFeedbackButtonProps {
  isSelected: boolean
}

export const StyledFeedbackButton = styled.button<StyledFeedbackButtonProps>(
  ({ theme, isSelected }) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.threeXS,
    margin: theme.spacing.none,
    backgroundColor: theme.colors.transparent,
    color: isSelected ? theme.colors.bodyText : theme.colors.fadedText60,
    border: "none",
    borderRadius: theme.radii.button,
    cursor: "pointer",
    userSelect: "none",
    minHeight: "unset",
    // Keeps the buttons from stacking when in containerWidth mode
    flex: "0 0 fit-content",

    "&:focus": {
      boxShadow: "none",
      outline: "none",
    },
    "&:focus-visible": {
      boxShadow: theme.shadows.focusRing,
    },
    "&:hover:not(:disabled)": {
      color: theme.colors.bodyText,
    },
    "&:disabled": {
      color: isSelected ? theme.colors.fadedText40 : theme.colors.fadedText10,
      cursor: "not-allowed",

      // For image content (like filled star icon)
      img: {
        opacity: 0.4,
      },
    },
  })
)
