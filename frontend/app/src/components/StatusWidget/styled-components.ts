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

import styled from "@emotion/styled"

/*
  "ConnectionStatus" styles are used for displaying
  the status of our connection to the server (connected,
  disconnected, error, etc).
*/

export const StyledConnectionStatus = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: theme.colors.gray60,
}))

export const StyledConnectionStatusLabel = styled.label(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
  color: theme.colors.gray60,
  textTransform: "uppercase",
  marginTop: theme.spacing.none,
  marginRight: theme.spacing.lg,
  marginBottom: theme.spacing.none,
  marginLeft: theme.spacing.sm,
  whiteSpace: "nowrap",
  maxWidth: theme.sizes.appStatusMaxWidth,
  lineHeight: theme.lineHeights.none,
}))

/*
  "AppStatus" styles are for app-related statuses:
  whether it's running, if the source file has changed on disk,
  etc.
*/

export const StyledAppStatus = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: theme.radii.md,
  margin: `0 ${theme.spacing.sm} 0 0`,
  paddingLeft: theme.spacing.sm,
  height: theme.sizes.appRunningMen,
}))

export interface StyledAppStatusLabelProps {
  isPrompt: boolean
}

export const StyledAppStatusLabel = styled.label<StyledAppStatusLabelProps>(
  ({ isPrompt, theme }) => ({
    fontSize: theme.fontSizes.sm,
    color: isPrompt ? theme.colors.bodyText : theme.colors.gray60,
    textTransform: isPrompt ? "none" : "uppercase",
    margin: `0 0 0 ${theme.spacing.sm}`,
    whiteSpace: "nowrap",
    maxWidth: theme.sizes.appStatusMaxWidth,
    borderRadius: isPrompt ? theme.radii.md : undefined,
  })
)

export const StyledAppButtonContainer = styled.span(({ theme }) => ({
  marginLeft: theme.spacing.md,
  whiteSpace: "nowrap",
  color: theme.colors.bodyText,
}))

export interface StyledAppRunningIconProps {
  isNewYears: boolean
}

export const StyledAppRunningIcon = styled.div<StyledAppRunningIconProps>(
  ({ isNewYears, theme }) => {
    // New years gif has unique styling - regular running man unchanged
    return {
      width: isNewYears ? "2.2rem" : theme.sizes.appRunningMen,
      height: isNewYears ? "2.2rem" : theme.sizes.appRunningMen,
      marginRight: `-${theme.spacing.sm}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "opacity 0.3s ease-in-out",
      cursor: "wait",
    }
  }
)

export const StyledStatusWidget = styled.div({
  "&.StatusWidget-appear": {
    opacity: 0,
  },

  "&.StatusWidget-appear-active": {
    opacity: 1,
    transition: "opacity 200ms ease-out",
  },

  "&.StatusWidget-enter": {
    opacity: 0,
  },

  "&.StatusWidget-enter-active": {
    opacity: 1,
    transition: "opacity 200ms ease-out",
  },

  "&.StatusWidget-exit": {
    opacity: 1,
  },

  "&.StatusWidget-exit-active": {
    opacity: 0,
    transition: "opacity 200ms ease-out",
  },
})

export const StyledShortcutLabel = styled.div({
  "&::first-letter": {
    textDecoration: "underline",
  },
})
