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

import styled, { StyledComponent } from "@emotion/styled"

import { hasLightBackgroundColor } from "@streamlit/lib/src/theme"

const TOP_DISTANCE = "-2.4rem"

export interface StyledToolbarWrapperProps {
  locked?: boolean
  target?: StyledComponent<any, any, any>
}

export const StyledToolbarWrapper = styled.div<StyledToolbarWrapperProps>(
  ({ theme, locked, target }) => ({
    padding: `${theme.spacing.sm} 0 ${theme.spacing.sm} ${theme.spacing.sm}`,
    position: "absolute",
    top: locked ? TOP_DISTANCE : "-1rem",
    right: theme.spacing.none,
    transition: "none",
    ...(!locked && {
      opacity: 0,
      "&:active, &:focus-visible, &:hover": {
        transition: "opacity 150ms 100ms, top 100ms 100ms",
        opacity: 1,
        top: TOP_DISTANCE,
      },
      ...(target && {
        [`${target}:hover &, ${target}:active &, ${target}:focus-visible &`]: {
          transition: "opacity 150ms 100ms, top 100ms 100ms",
          opacity: 1,
          top: TOP_DISTANCE,
        },
      }),
    }),
  })
)

export const StyledToolbar = styled.div(({ theme }) => ({
  color: hasLightBackgroundColor(theme)
    ? theme.colors.fadedText60
    : theme.colors.bodyText,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "flex-end",
  boxShadow: "1px 2px 8px rgba(0, 0, 0, 0.08)",
  borderRadius: theme.radii.default,
  backgroundColor: theme.colors.lightenedBg05,
  width: "fit-content",
  zIndex: theme.zIndices.sidebar + 1,
}))
