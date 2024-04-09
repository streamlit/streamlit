/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

export const StyledViewButton = styled.button(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
  lineHeight: "1.4rem",
  color: theme.colors.fadedText60,
  backgroundColor: theme.colors.transparent,
  border: "none",
  boxShadow: "none",
  padding: "0px",
  "&:hover, &:active, &:focus": {
    border: "none",
    outline: "none",
    boxShadow: "none",
  },
  "&:hover": {
    color: theme.colors.primary,
  },
}))

interface StyledToastMessageProps {
  expanded: boolean
}

export const StyledToastWrapper = styled.div<StyledToastMessageProps>(
  ({ theme }) => ({
    display: "flex",
    flexDirection: "row",
    gap: theme.spacing.lg,
  })
)

export const StyledIcon = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.xl,
}))

export const StyledMessageWrapper = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.sm,
  alignItems: "start",
  // Align text to the center of the icon when only 1 line.
  justifyContent: "center",
  overflow: "hidden",
  minHeight: "100%",
  fontSize: theme.fontSizes.sm,
  lineHeight: theme.lineHeights.base,
}))
