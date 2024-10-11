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

import React from "react"

import styled from "@emotion/styled"

import { StyledCheckbox } from "@streamlit/lib/src/components/widgets/Checkbox/styled-components"
import { Block as BlockProto } from "@streamlit/lib/src/proto"
import { EmotionTheme } from "@streamlit/lib/src/theme"

function translateGapWidth(gap: string, theme: EmotionTheme): string {
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

const GLOBAL_ELEMENTS = ["balloons", "snow"]
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

    ":is(.stHtml-empty)": {
      display: "none",
    },

    ":has(> .stCacheSpinner)": {
      height: theme.spacing.none,
      overflow: "visible",
      visibility: "visible",
      marginBottom: `-${theme.spacing.lg}`,
      zIndex: theme.zIndices.cacheSpinner,
    },

    ":has(> .stPageLink)": {
      marginTop: `-${theme.spacing.xs}`,
      marginBottom: `-${theme.spacing.xs}`,
    },
    // Lower the min height of stacked/grouped checkboxes to have them appear visually
    // closer together to each other.
    // To detect & cover all grouped/stacked checkboxes, we apply a complex CSS selector
    // that selects all checkboxes that are directly followed by another checkbox.
    // Since the last checkbox in a group isn't followed by another checkbox, we also
    // need to target the direct sibling (if it is a checkbox) of any of the targeted checkboxes.
    // Examples:
    // Smaller width is not applied because single checkbox:
    // <text-input><checkbox><number-input>
    // Smaller width is applied to all checkboxes:
    // <text-input><checkbox><checkbox><checkbox><number-input>
    // Smaller width only applied to the first two checkboxes:
    // <text-input><checkbox><checkbox><number-input><checkbox><selectbox>
    [`&:has(+ & > ${StyledCheckbox}) > ${StyledCheckbox}, &:has(> ${StyledCheckbox}):has(+ & > ${StyledCheckbox}) + & > ${StyledCheckbox}`]:
      {
        minHeight: theme.spacing.twoXL,
      },

    ...(isStale && elementType !== "skeleton"
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
    ...(GLOBAL_ELEMENTS.includes(elementType)
      ? {
          // Global elements are rendered in their delta position, but they
          // are not part of the flexbox layout. We apply a negative margin
          // to remove the flexbox gap. display: none does not work for these,
          // since they needs to be visible.
          marginBottom: `-${theme.spacing.lg}`,
        }
      : {}),
  })
)

interface StyledColumnProps {
  weight: number
  gap: string
  verticalAlignment?: BlockProto.Column.VerticalAlignment
}

export const StyledColumn = styled.div<StyledColumnProps>(
  ({ weight, gap, theme, verticalAlignment }) => {
    const { VerticalAlignment } = BlockProto.Column
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
      ...(verticalAlignment === VerticalAlignment.BOTTOM && {
        marginTop: "auto",
      }),
      ...(verticalAlignment === VerticalAlignment.CENTER && {
        marginTop: "auto",
        marginBottom: "auto",
      }),
    }
  }
)

export interface StyledVerticalBlockProps {
  ref?: React.RefObject<any>
  width?: number
}

export const StyledVerticalBlock = styled.div<StyledVerticalBlockProps>(
  ({ width, theme }) => ({
    width,
    position: "relative", // Required for the automatic width computation.
    display: "flex",
    flex: 1,
    flexDirection: "column",
    gap: theme.spacing.lg,
  })
)

export const StyledVerticalBlockWrapper = styled.div<StyledVerticalBlockProps>(
  {
    display: "flex",
    flexDirection: "column",
    flex: 1,
  }
)

export interface StyledVerticalBlockBorderWrapperProps {
  border: boolean
  height?: number
}

export const StyledVerticalBlockBorderWrapper =
  styled.div<StyledVerticalBlockBorderWrapperProps>(
    ({ theme, border, height }) => ({
      ...(border && {
        border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
        borderRadius: theme.radii.default,
        padding: `calc(${theme.spacing.lg} - ${theme.sizes.borderWidth})`,
      }),
      ...(height && {
        height: `${height}px`,
        overflow: "auto",
      }),
    })
  )
