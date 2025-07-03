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

import React from "react"

import { isInteger } from "lodash"
import styled from "@emotion/styled"

import { Block as BlockProto, streamlit } from "@streamlit/protobuf"

import { StyledCheckbox } from "~lib/components/widgets/Checkbox/styled-components"
import { EmotionTheme, STALE_STYLES } from "~lib/theme"

function translateGapWidth(
  gap: streamlit.GapSize | undefined,
  theme: EmotionTheme
): string {
  let gapWidth = theme.spacing.lg
  if (gap === streamlit.GapSize.MEDIUM) {
    gapWidth = theme.spacing.threeXL
  } else if (gap === streamlit.GapSize.LARGE) {
    gapWidth = theme.spacing.fourXL
  } else if (gap === streamlit.GapSize.NONE) {
    gapWidth = theme.spacing.none
  }
  return gapWidth
}

export interface StyledElementContainerProps {
  isStale: boolean
  width: React.CSSProperties["width"]
  height: React.CSSProperties["height"]
  elementType: string
  overflow: React.CSSProperties["overflow"]
  flex?: React.CSSProperties["flex"]
}

const GLOBAL_ELEMENTS = ["balloons", "snow"]
export const StyledElementContainer = styled.div<StyledElementContainerProps>(
  ({ theme, isStale, width, height, elementType, overflow, flex }) => ({
    width,
    height,
    maxWidth: "100%",
    // Allows to have absolutely-positioned nodes inside app elements, like
    // floating buttons.
    position: "relative",
    overflow,
    flex,

    "@media print": {
      overflow: "visible",
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

    ...(isStale && elementType !== "skeleton" && STALE_STYLES),
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
  gap: streamlit.GapSize | undefined
  showBorder: boolean
  verticalAlignment?: BlockProto.Column.VerticalAlignment
}

export const StyledColumn = styled.div<StyledColumnProps>(
  ({ theme, weight, gap, showBorder, verticalAlignment }) => {
    const { VerticalAlignment } = BlockProto.Column
    const percentage = weight * 100
    const gapWidth = translateGapWidth(gap, theme)
    const width =
      gapWidth === theme.spacing.none
        ? `${percentage}%`
        : `calc(${percentage}% - ${gapWidth})`

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
        // Add margin to the first checkbox/toggle within the column to align it
        // better with other input widgets.
        [`& ${StyledElementContainer}:last-of-type > ${StyledCheckbox}`]: {
          marginBottom: theme.spacing.sm,
        },
      }),
      ...(verticalAlignment === VerticalAlignment.TOP && {
        // Add margin to the first checkbox/toggle within the column to align it
        // better with other input widgets.
        [`& ${StyledElementContainer}:first-of-type > ${StyledCheckbox}`]: {
          marginTop: theme.spacing.sm,
        },
      }),
      ...(verticalAlignment === VerticalAlignment.CENTER && {
        marginTop: "auto",
        marginBottom: "auto",
      }),
      ...(showBorder && {
        border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
        borderRadius: theme.radii.default,
        padding: `calc(${theme.spacing.lg} - ${theme.sizes.borderWidth})`,
      }),
    }
  }
)

export interface StyledFlexContainerBlockProps {
  direction: React.CSSProperties["flexDirection"]
  gap?: streamlit.GapSize | undefined
  flex?: React.CSSProperties["flex"]
  // This marks the prop as a transient property so it is
  // not passed to the DOM. It overlaps with a valid attribute
  // so passing it to the DOM will cause an error in the console.
  $wrap?: boolean
  height?: React.CSSProperties["height"]
  border: boolean
}

export const StyledFlexContainerBlock =
  styled.div<StyledFlexContainerBlockProps>(
    ({ theme, direction, gap, flex, $wrap, height, border }) => {
      let gapWidth
      if (gap !== undefined) {
        gapWidth = translateGapWidth(gap, theme)
      }

      return {
        display: "flex",
        gap: gapWidth,
        width: "100%",
        maxWidth: "100%",
        height: height ?? "auto",
        overflow: isInteger(height) ? "auto" : "visible",
        flexDirection: direction,
        flex,
        flexWrap: $wrap ? "wrap" : "nowrap",
        ...(border && {
          border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
          borderRadius: theme.radii.default,
          padding: `calc(${theme.spacing.lg} - ${theme.sizes.borderWidth})`,
        }),
      }
    }
  )

export interface StyledLayoutWrapperProps {
  width?: React.CSSProperties["width"]
  height?: React.CSSProperties["height"]
  flex?: React.CSSProperties["flex"]
}

export const StyledLayoutWrapper = styled.div<StyledLayoutWrapperProps>(
  ({ width, height, flex }) => ({
    display: "flex",
    width,
    maxWidth: "100%",
    height,
    flex,
  })
)
