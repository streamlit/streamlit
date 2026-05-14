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

import { CSSProperties } from "react"

import styled from "@emotion/styled"

import { Block as BlockProto, streamlit } from "@streamlit/protobuf"

import { StyledCheckbox } from "~lib/components/widgets/Checkbox/styled-components"
import { STALE_STYLES } from "~lib/theme/consts"
import type { EmotionTheme } from "~lib/theme/types"
import { assertNever } from "~lib/util/assertNever"

function translateGapWidth(
  gap: streamlit.GapSize | undefined,
  theme: EmotionTheme
): string {
  switch (gap) {
    case streamlit.GapSize.XXSMALL:
      return theme.spacing.twoXS
    case streamlit.GapSize.XSMALL:
      return theme.spacing.sm
    case streamlit.GapSize.SMALL:
      return theme.spacing.lg
    case streamlit.GapSize.MEDIUM:
      return theme.spacing.threeXL
    case streamlit.GapSize.LARGE:
      return theme.spacing.fourXL
    case streamlit.GapSize.XLARGE:
      return theme.spacing.fiveXL
    case streamlit.GapSize.XXLARGE:
      return theme.spacing.sixXL
    case streamlit.GapSize.NONE:
      return theme.spacing.none
    default:
      return theme.spacing.lg
  }
}

interface StyledElementContainerProps {
  isStale: boolean
  width: React.CSSProperties["width"]
  height: React.CSSProperties["height"]
  elementType: string
  overflow: React.CSSProperties["overflow"]
  flex?: React.CSSProperties["flex"]
  minWidth?: React.CSSProperties["minWidth"]
  textAlign?: React.CSSProperties["textAlign"]
}

export const StyledSpace = styled.div({
  // Styling is handled in StyledElementContainerLayoutWrapper.
  // Space component should fill the container.
  width: "100%",
  height: "100%",
})

const GLOBAL_ELEMENTS = ["balloons", "snow"]
export const StyledElementContainer = styled.div<StyledElementContainerProps>(
  ({
    theme,
    isStale,
    width,
    height,
    elementType,
    overflow,
    flex,
    minWidth,
    textAlign,
  }) => ({
    width,
    height,
    textAlign,
    maxWidth: "100%",
    // Important so that individual elements don't take up too much space
    // in horizontal layouts. Particularly when an element uses the full screen wrapper.
    // Some components support zero width (e.g. iframe).
    minWidth: width === "0px" ? 0 : (minWidth ?? "1rem"),
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
    ...(elementType === "space"
      ? {
          // Space elements should have minimal cross-axis dimensions.
          // The FlexContext logic in StyledElementContainerLayoutWrapper handles
          // the primary dimension (width for horizontal, height for vertical).
          minWidth: 0,
          minHeight: 0,
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

const getAlignItems = (
  align: BlockProto.FlexContainer.Align | undefined | null
): CSSProperties["alignItems"] => {
  switch (align) {
    case BlockProto.FlexContainer.Align.ALIGN_START:
      return "start"
    case BlockProto.FlexContainer.Align.ALIGN_CENTER:
      return "center"
    case BlockProto.FlexContainer.Align.ALIGN_END:
      return "end"
    case BlockProto.FlexContainer.Align.STRETCH:
      return "stretch"
    case BlockProto.FlexContainer.Align.ALIGN_UNDEFINED:
    case undefined:
    case null:
      return "stretch"
    default:
      return assertNever(align)
  }
}

const getJustifyContent = (
  justify: BlockProto.FlexContainer.Justify | undefined | null
): CSSProperties["justifyContent"] => {
  switch (justify) {
    case BlockProto.FlexContainer.Justify.JUSTIFY_START:
      return "start"
    case BlockProto.FlexContainer.Justify.JUSTIFY_CENTER:
      return "center"
    case BlockProto.FlexContainer.Justify.JUSTIFY_END:
      return "end"
    case BlockProto.FlexContainer.Justify.SPACE_BETWEEN:
      return "space-between"
    case BlockProto.FlexContainer.Justify.JUSTIFY_UNDEFINED:
    case undefined:
    case null:
      return "start"
    default:
      return assertNever(justify)
  }
}

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
  align?: BlockProto.FlexContainer.Align | null
  justify?: BlockProto.FlexContainer.Justify | null
  overflow?: React.CSSProperties["overflow"]
}

export const StyledFlexContainerBlock =
  styled.div<StyledFlexContainerBlockProps>(
    ({
      theme,
      direction,
      gap,
      flex,
      $wrap,
      height,
      border,
      align,
      justify,
      overflow,
    }) => {
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
        minWidth: "1rem",
        flexDirection: direction,
        flex,
        alignItems: getAlignItems(align),
        justifyContent: getJustifyContent(justify),
        flexWrap: $wrap ? "wrap" : "nowrap",
        ...(border && {
          border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
          borderRadius: theme.radii.default,
          padding: `calc(${theme.spacing.lg} - ${theme.sizes.borderWidth})`,
        }),
        overflow,
      }
    }
  )

interface StyledLayoutWrapperProps {
  width?: React.CSSProperties["width"]
  height?: React.CSSProperties["height"]
  flex?: React.CSSProperties["flex"]
}

export const StyledLayoutWrapper = styled.div<StyledLayoutWrapperProps>(
  ({ width, height, flex }) => ({
    display: "flex",
    // This shouldn't matter since this is a wrapper and should only have one child.
    // However, adding it here to be explicit.
    flexDirection: "column",
    width,
    maxWidth: "100%",
    minWidth: "1rem",
    height,
    flex,
  })
)

export interface StyledGridContainerBlockProps {
  maxColumns: number
  minColumnWidthPx: number
  rowGap: streamlit.GapSize | undefined
  columnGap: streamlit.GapSize | undefined
  cellHeightMode: BlockProto.GridContainer.CellHeightMode
  cellHeightPx?: number
}

/**
 * Computes the CSS grid-template-columns value based on configuration.
 *
 * When maxColumns is 0 (auto mode), we use auto-fit with minmax to let the
 * browser determine the number of columns based on available width.
 *
 * When maxColumns is set, we optionally incorporate minColumnWidth to allow
 * responsive wrapping, or use fixed equal columns if no minimum is specified.
 */
function computeGridTemplateColumns(
  maxColumns: number,
  minColumnWidthPx: number,
  columnGapPx: string
): string {
  if (maxColumns === 0) {
    // Auto mode: columns determined by min width
    return `repeat(auto-fit, minmax(min(100%, ${minColumnWidthPx}px), 1fr))`
  }

  if (minColumnWidthPx > 0) {
    // Fixed column count with min width: allow responsive wrapping
    // Use min(100%, minWidth) to ensure columns can collapse to single column
    return `repeat(auto-fit, minmax(min(100%, max(${minColumnWidthPx}px, calc((100% - ${maxColumns - 1} * ${columnGapPx}) / ${maxColumns}))), 1fr))`
  }

  // Fixed column count without min width: strict equal columns
  return `repeat(${maxColumns}, minmax(0, 1fr))`
}

export const StyledGridContainerBlock =
  styled.div<StyledGridContainerBlockProps>(
    ({
      theme,
      maxColumns,
      minColumnWidthPx,
      rowGap,
      columnGap,
      cellHeightMode,
      cellHeightPx,
    }) => {
      const rowGapPx = translateGapWidth(rowGap, theme)
      const columnGapPx = translateGapWidth(columnGap, theme)

      // Determine grid-auto-rows based on cell height mode
      let gridAutoRows: string
      const { CellHeightMode } = BlockProto.GridContainer
      switch (cellHeightMode) {
        case CellHeightMode.EQUAL:
          gridAutoRows = "1fr"
          break
        case CellHeightMode.FIXED:
          gridAutoRows = cellHeightPx ? `${cellHeightPx}px` : "auto"
          break
        case CellHeightMode.CONTENT:
        default:
          gridAutoRows = "auto"
      }

      return {
        display: "grid",
        width: "100%",
        maxWidth: "100%",
        minWidth: "1rem",
        gap: `${rowGapPx} ${columnGapPx}`,
        gridTemplateColumns: computeGridTemplateColumns(
          maxColumns,
          minColumnWidthPx,
          columnGapPx
        ),
        gridAutoRows,
        // Prevent spans from creating implicit columns by making them 0-width
        gridAutoColumns: 0,
      }
    }
  )

export interface StyledGridCellProps {
  verticalAlignment: BlockProto.GridContainer.VerticalAlignment
  showBorder: boolean
  hasFixedHeight: boolean
  columnSpan?: number
  rowSpan?: number
}

export const StyledGridCell = styled.div<StyledGridCellProps>(
  ({
    theme,
    verticalAlignment,
    showBorder,
    hasFixedHeight,
    columnSpan,
    rowSpan,
  }) => {
    const { VerticalAlignment } = BlockProto.GridContainer

    // Map vertical alignment to CSS justify-content (since we use column direction)
    // Use "safe" keyword for center/end to prevent content from overflowing
    // when it's larger than the container
    let justifyContent: string
    switch (verticalAlignment) {
      case VerticalAlignment.CENTER:
        justifyContent = "safe center"
        break
      case VerticalAlignment.BOTTOM:
        justifyContent = "safe flex-end"
        break
      case VerticalAlignment.TOP:
      default:
        justifyContent = "flex-start"
    }

    return {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent,
      minWidth: 0,
      minHeight: 0,
      maxWidth: "100%",
      // For fixed height cells, use overflow-y auto to allow scrolling
      // but keep overflow-x visible so toolbars/menus aren't clipped
      ...(hasFixedHeight && { overflowY: "auto", overflowX: "clip" }),
      ...(showBorder && {
        border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
        borderRadius: theme.radii.default,
        padding: `calc(${theme.spacing.lg} - ${theme.sizes.borderWidth})`,
      }),
      ...(columnSpan &&
        columnSpan > 1 && { gridColumn: `span ${columnSpan}` }),
      ...(rowSpan && rowSpan > 1 && { gridRow: `span ${rowSpan}` }),
    }
  }
)
