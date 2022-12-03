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

import React from "react"
import styled from "@emotion/styled"
import { Theme } from "src/theme"

function translateGapWidth(gap: string, theme: Theme): string {
  let gapWidth = theme.spacing.lg
  if (gap === "medium") {
    gapWidth = theme.spacing.threeXL
  } else if (gap === "large") {
    gapWidth = theme.spacing.fourXL
  }
  return gapWidth
}
export interface StyledHorizontalBlockProps {
  gap: string
}

export const StyledHorizontalBlock = styled.div<StyledHorizontalBlockProps>(
  ({ theme, gap }) => {
    const gapWidth = translateGapWidth(gap, theme)

    return {
      // While using flex for columns, padding is used for large screens and gap
      // for small ones. This can be adjusted once more information is passed.
      // More information and discussions can be found: Issue #2716, PR #2811
      display: "flex",
      flexWrap: "wrap",
      flexGrow: 1,
      alignItems: "stretch",
      gap: gapWidth,
    }
  }
)

export interface StyledElementContainerProps {
  isStale: boolean
  width: number
  elementType: string
}

export const StyledElementContainer = styled.div<StyledElementContainerProps>(
  ({ theme, isStale, width, elementType }) => ({
    width,
    // Allows to have absolutely-positioned nodes inside app elements, like
    // floating buttons.
    position: "relative",

    "@media print": {
      "@-moz-document url-prefix()": {
        display: "block",
      },
      overflow: "visible",
    },

    ...(isStale
      ? {
          opacity: 0.33,
          transition: "opacity 1s ease-in 0.5s",
        }
      : {}),
    ...(elementType === "empty"
      ? {
          // Use display: none for empty elements to avoid the flexbox gap.
          display: "none",
        }
      : {}),
    ...(elementType === "balloons"
      ? {
          // Apply negative bottom margin to remove the flexbox gap.
          // display: none does not work for balloons, since it needs to be visible.
          marginBottom: `-${theme.spacing.lg}`,
        }
      : {}),
  })
)

interface StyledColumnProps {
  weight: number
  gap: string
}

export const StyledColumn = styled.div<StyledColumnProps>(
  ({ weight, gap, theme }) => {
    const percentage = weight * 100
    const gapWidth = translateGapWidth(gap, theme)
    const width = `calc(${percentage}% - ${gapWidth})`

    return {
      // Calculate width based on percentage, but fill all available space,
      // e.g. if it overflows to next row.
      width,
      flex: `1 1 ${width}`,

      [`@media (max-width: ${theme.breakpoints.columns})`]: {
        minWidth: `calc(100% - ${theme.spacing.twoXL})`,
      },
    }
  }
)

export interface StyledFormProps {
  theme: Theme
}

export const StyledForm = styled.div<StyledFormProps>(({ theme }) => ({
  padding: theme.spacing.lg,
  border: `1px solid ${theme.colors.fadedText10}`,
  borderRadius: theme.radii.md,
}))

export const styledVerticalBlockWrapperStyles: any = {
  display: "flex",
  flexDirection: "column",
  flex: 1,
}

export interface StyledVerticalBlockProps {
  ref?: React.RefObject<any>
  width?: number
}

export const StyledVerticalBlock = styled.div<StyledVerticalBlockProps>(
  // @ts-ignore
  ({ width, theme }) => ({
    width,
    position: "relative", // Required for the automatic width computation.

    display: "flex",
    flex: 1,
    flexDirection: "column",
    gap: theme.spacing.lg,
  })
)

/*
Used by @npm/iframe-resizer to determine the page height
*/
export interface StyledIFrameResizerAnchorProps {
  isEmbedded: boolean
}

export const StyledIFrameResizerAnchor =
  styled.div<StyledIFrameResizerAnchorProps>(({ isEmbedded }) => ({
    position: "absolute",
    // 10rem: StyledAppViewBlockContainer padding-bottom
    // 39px:  StyledAppViewFooter computed height
    bottom: isEmbedded ? "-1rem" : "calc( -1 * (10rem + 39px))",
  }))
