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
import { transparentize } from "color2k"

interface StyledTabContainerProps {
  isOverflowing: boolean
  width: React.CSSProperties["width"]
  flex: React.CSSProperties["flex"]
}

export const StyledTabContainer = styled.div<StyledTabContainerProps>(
  ({ isOverflowing, width, flex }) => ({
    position: isOverflowing ? "relative" : undefined,
    width: width || undefined,
    flex: flex || undefined,
  })
)

interface StyledScrollArrowProps {
  position: "left" | "right"
  tabHeight: string
}

export const StyledScrollArrow = styled.button<StyledScrollArrowProps>(
  ({ theme, position, tabHeight }) => ({
    position: "absolute",
    top: 0,
    [position]: 0,
    zIndex: theme.zIndices.priority,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: tabHeight,
    width: theme.spacing.xl,
    padding: 0,
    border: "none",
    cursor: "pointer",
    color: theme.colors.fadedText60,
    background: "transparent",
    // Apply gradient background on the side closest to the content
    backgroundImage:
      position === "right"
        ? `linear-gradient(to right, ${transparentize(
            theme.colors.bgColor,
            1
          )}, ${theme.colors.bgColor} 40%)`
        : `linear-gradient(to left, ${transparentize(
            theme.colors.bgColor,
            1
          )}, ${theme.colors.bgColor} 40%)`,

    "&:hover": {
      color: theme.colors.bodyText,
    },

    "&:focus": {
      outline: "none",
    },

    "&:focus-visible": {
      boxShadow: theme.shadows.focusRing,
    },
  })
)
