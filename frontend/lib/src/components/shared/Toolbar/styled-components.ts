/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import { hasLightBackgroundColor } from "@streamlit/lib/src/theme"

export interface StyledToolbarProps {
  isFullscreen?: boolean
}

export const StyledToolbar = styled.div<StyledToolbarProps>(
  ({ theme, isFullscreen }) => ({
    color: hasLightBackgroundColor(theme)
      ? theme.colors.fadedText60
      : theme.colors.bodyText,
    top: "-2.1rem",
    right: "0rem",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
    justifyContent: "flex-end",
    boxShadow: "1px 2px 8px rgba(0, 0, 0, 0.08)",
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.lightenedBg05,
    width: "fit-content",
    position: "absolute",
    zIndex: theme.zIndices.sidebar + 1,
    ...(!isFullscreen && {
      transition: "opacity 300ms 150ms, transform 300ms 150ms",
      opacity: 0,
      "&:active, &:focus-visible, &:hover": {
        opacity: 1,
        transition: "none",
      },
    }),
  })
)
