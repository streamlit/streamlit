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

import type { CSSProperties } from "react"

import { css } from "@emotion/react"
import styled from "@emotion/styled"

import { Block as BlockProto, streamlit } from "@streamlit/protobuf"

import {
  STEP_CONNECTOR_BOTTOM_VAR,
  STEP_FOLLOWED_BY_STEP_SELECTOR,
} from "~lib/components/core/Layout/stepConnector"
import { Direction } from "~lib/components/core/Layout/utils"
import { STALE_STYLES } from "~lib/theme/consts"
import type { EmotionTheme } from "~lib/theme/types"
import { assertNever } from "~lib/util/assertNever"

import { computeGridTemplateColumns } from "./gridUtils"

/**
 * Column vertical-alignment rules target the wrapper class rather than the two
 * field styled-components, so both widgets stay covered if their inner React
 * Aria composition changes.
 */
const CHECKBOX_WRAPPER_SELECTOR = ".stCheckbox"

export function translateGapWidth(
  gap: streamlit.GapConfig.$Properties | undefined,
  theme: EmotionTheme
): string {
  if (typeof gap?.pixelGap === "number") {
    return `${gap.pixelGap}px`
  }
  switch (gap?.gapSize) {
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
  minHeight?: React.CSSProperties["minHeight"]
  textAlign?: React.CSSProperties["textAlign"]
}

export const StyledSpace = styled.div({
  // Styling is handled in StyledElementContainerLayoutWrapper.
  // Space component should fill the container.
  width: "100%",
  height: "100%",
})

const GLOBAL_ELEMENTS = new Set(["balloons", "snow"])
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
    minHeight,
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
    minHeight,
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
    ...(GLOBAL_ELEMENTS.has(elementType)
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
  gap: streamlit.GapConfig.$Properties | undefined
  showBorder: boolean
  verticalAlignment?: BlockProto.Column.VerticalAlignment
  /**
   * Whether the parent row allows wrapping/stacking. When true (default),
   * columns stack below the columns breakpoint. When false, columns keep a
   * usable minimum width and scroll horizontally instead.
   */
  $wrap?: boolean
}

export const StyledColumn = styled.div<StyledColumnProps>(
  ({ theme, weight, gap, showBorder, verticalAlignment, $wrap = true }) => {
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
      ...($wrap
        ? {
            [`@media (max-width: ${theme.breakpoints.columns})`]: {
              minWidth: `calc(100% - ${theme.spacing.twoXL})`,
            },
          }
        : {
            // Usable floor so nowrap columns scroll instead of shrinking to zero.
            minWidth: theme.spacing.sixXL,
          }),
      ...(verticalAlignment === VerticalAlignment.BOTTOM && {
        marginTop: "auto",
        // Align the last direct-child checkbox/toggle with other input widgets.
        // Scoped to the column's own stVerticalBlock so nested containers
        // (e.g. horizontal containers of checkboxes) do not also get matched
        // (issue #13162).
        [`& > .stVerticalBlock > ${StyledElementContainer}:last-of-type > ${CHECKBOX_WRAPPER_SELECTOR}`]:
          {
            marginBottom: theme.spacing.sm,
          },
      }),
      ...(verticalAlignment === VerticalAlignment.TOP && {
        // Align the first direct-child checkbox/toggle with other input
        // widgets. Scoped to the column's own stVerticalBlock so nested
        // containers (e.g. horizontal containers of checkboxes) do not also
        // get matched (issue #13162).
        [`& > .stVerticalBlock > ${StyledElementContainer}:first-of-type > ${CHECKBOX_WRAPPER_SELECTOR}`]:
          {
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
  gap?: streamlit.GapConfig.$Properties | undefined
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
  /**
   * Horizontal overflow behavior. Set to "auto" for a horizontal container
   * with `wrap=false` so its elements stay in a single, horizontally
   * scrollable row. When set, applied as `overflowX` alongside `overflowY`
   * (from `overflow`) instead of the `overflow` shorthand.
   */
  overflowX?: React.CSSProperties["overflowX"]
  minHeight?: React.CSSProperties["minHeight"]
  /**
   * Replaces the proto justify when a `grid.cell()` block fills a
   * definite-height row. `safe` is a second declaration so an unknown
   * keyword does not drop the fallback.
   */
  $fillJustify?: { fallback: CSSProperties["justifyContent"]; safe?: string }
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
      overflowX,
      minHeight,
      $fillJustify,
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
        justifyContent: $fillJustify?.fallback ?? getJustifyContent(justify),
        minHeight,
        flexWrap: $wrap ? "wrap" : "nowrap",
        ...(border && {
          border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
          borderRadius: theme.radii.default,
          padding: `calc(${theme.spacing.lg} - ${theme.sizes.borderWidth})`,
        }),
        ...(overflowX !== undefined
          ? {
              overflowX,
              // `overflow` is a single-keyword value from layout styles
              // (`visible`/`auto`/`hidden`), which is valid as overflow-y.
              overflowY: overflow as React.CSSProperties["overflowY"],
              // The browser coerces the cross-axis overflow to "auto" when one
              // axis scrolls, which would clip child focus rings and shadows.
              // A bordered container already has enough internal padding; an
              // unbordered one gets vertical breathing room (cancelled by a
              // negative margin so the outer layout is unchanged).
              ...(!border && {
                paddingBlock: theme.sizes.focusRingWidth,
                marginBlock: `-${theme.sizes.focusRingWidth}`,
              }),
            }
          : { overflow }),
        // Consecutive steps should read as one continuous timeline, so a step's
        // connector has to span the flex gap separating it from the next step.
        // The property holds a negative `bottom` offset for the connector, and
        // this container is the only place that knows the gap size. Re-declaring
        // it here confines the inherited value to one level, so a step nested
        // inside another step's content starts from zero again.
        [STEP_CONNECTOR_BOTTOM_VAR]: theme.spacing.none,
        ...(direction === Direction.VERTICAL &&
          gapWidth && {
            // Scoping to steps that are directly followed by another step keeps
            // the line from dangling after the last step or after an
            // interleaved non-step element.
            [STEP_FOLLOWED_BY_STEP_SELECTOR]: {
              [STEP_CONNECTOR_BOTTOM_VAR]: `-${gapWidth}`,
            },
          }),
      }
    },
    // Unknown `safe` must not drop the fallback alignment.
    ({ $fillJustify }) =>
      $fillJustify?.safe &&
      css`
        justify-content: ${$fillJustify.safe};
      `
  )

interface StyledLayoutWrapperProps {
  width?: React.CSSProperties["width"]
  height?: React.CSSProperties["height"]
  flex?: React.CSSProperties["flex"]
  minHeight?: React.CSSProperties["minHeight"]
}

/**
 * In-flow spacer after the last dialog widget. Drawer bodies scroll a
 * height:100% child, so padding on ModalBody never appears below that content.
 * margin-top cancels the vertical-block SMALL gap so the pad is exactly
 * threeXL below the last widget.
 */
export const StyledDialogContentEndPad = styled.div(({ theme }) => ({
  flexShrink: 0,
  marginTop: `-${theme.spacing.lg}`,
  height: theme.spacing.threeXL,
  width: "100%",
  pointerEvents: "none",
}))

export const StyledLayoutWrapper = styled.div<StyledLayoutWrapperProps>(
  ({ width, height, flex, minHeight }) => ({
    display: "flex",
    // This shouldn't matter since this is a wrapper and should only have one child.
    // However, adding it here to be explicit.
    flexDirection: "column",
    width,
    maxWidth: "100%",
    minWidth: "1rem",
    height,
    flex,
    minHeight,
  })
)

export interface StyledGridContainerBlockProps {
  columnCount: number
  minColumnWidthPx: number
  $wrap: boolean
  rowGap: streamlit.GapConfig.$Properties | undefined
  columnGap: streamlit.GapConfig.$Properties | undefined
  cellHeightMode: BlockProto.GridContainer.CellHeightMode
  cellHeightPx?: number
  $dense?: boolean
  /**
   * When true, this element is the horizontal scrollport. Bounded-height
   * grids apply that overflow on StyledGridScrollBody instead. Only set
   * once tracks are wider than the box: overflow-x: auto coerces
   * overflow-y: visible to auto and clips hover toolbars.
   */
  $horizontalScroll?: boolean
}

export const StyledGridContainerBlock =
  styled.div<StyledGridContainerBlockProps>(
    ({
      theme,
      columnCount,
      minColumnWidthPx,
      $wrap,
      rowGap,
      columnGap,
      cellHeightMode,
      cellHeightPx,
      $dense,
      $horizontalScroll = false,
    }) => {
      const rowGapPx = translateGapWidth(rowGap, theme)
      const columnGapPx = translateGapWidth(columnGap, theme)

      // Pixel row_height is a fixed track. Content, and the reserved EQUAL
      // value, size each row to its tallest cell.
      const gridAutoRows =
        cellHeightMode === BlockProto.GridContainer.CellHeightMode.FIXED &&
        cellHeightPx
          ? `${cellHeightPx}px`
          : "auto"

      return {
        display: "grid",
        width: "100%",
        maxWidth: "100%",
        // Tracks stay auto inside a bounded grid so the overflow port can
        // measure them and scroll only when they exceed the box.
        height: "auto",
        minWidth: "1rem",
        minHeight: 0,
        gap: `${rowGapPx} ${columnGapPx}`,
        gridTemplateColumns: computeGridTemplateColumns({
          columnCount,
          minColumnWidthPx,
          wrap: $wrap,
        }),
        gridAutoRows,
        // wrap=False keeps the declared track count and scrolls locally,
        // but only once the tracks are wider than this box.
        ...($horizontalScroll && {
          overflowX: "auto" as const,
          overflowY: "visible" as const,
          // One-axis overflow can coerce the other axis, which would clip
          // child focus rings. Cancel the extra padding with a negative
          // margin so the outer layout is unchanged.
          paddingBlock: theme.sizes.focusRingWidth,
          marginBlock: `-${theme.sizes.focusRingWidth}`,
        }),
        // Dense packing mode fills gaps by reordering items
        ...($dense && { gridAutoFlow: "dense" }),
      }
    }
  )

/**
 * Bounded-height port around a content-sized grid. Fills the layout wrapper
 * and becomes a vertical scrollport only when in-flow tracks exceed it, so
 * chart hover toolbars stay visible when nothing actually overflows.
 */
export const StyledGridScrollBody = styled.div<{
  $scroll: boolean
  $horizontalScroll: boolean
  $bounded: boolean
}>(({ theme, $scroll, $horizontalScroll, $bounded }) => {
  // Content-height grids keep this node so a later pixel/stretch height
  // does not remount the grid. `display: contents` leaves layout unchanged.
  if (!$bounded) {
    return { display: "contents" }
  }

  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    width: "100%",
    minHeight: 0,
    flex: 1,
    height: "100%",
    maxHeight: "100%",
    ...($scroll && {
      overflowY: "auto" as const,
      overflowX: $horizontalScroll ? ("auto" as const) : ("clip" as const),
    }),
    ...(!$scroll &&
      $horizontalScroll && {
        overflowX: "auto" as const,
        overflowY: "visible" as const,
        paddingBlock: theme.sizes.focusRingWidth,
        marginBlock: `-${theme.sizes.focusRingWidth}`,
      }),
  }
})

/**
 * Grows with grid tracks so ResizeObserver can detect overflow without
 * reading scrollHeight.
 */
export const StyledGridContentMeasure = styled.div<{
  $minWidthPx?: number
  $passthrough?: boolean
}>(({ $minWidthPx, $passthrough }) => {
  if ($passthrough) {
    return { display: "contents" }
  }

  return {
    width: "100%",
    // A percentage width alone stays inside the scrollport, so wrap=False
    // tracks never increase scrollWidth. The track floor lets this box grow
    // past the port; a wider port still stretches it via width: 100%.
    ...($minWidthPx !== undefined &&
      $minWidthPx > 0 && { minWidth: `${$minWidthPx}px` }),
    minHeight: "min-content",
    flexShrink: 0,
  }
})

type GridCellJustify = {
  fallback: CSSProperties["justifyContent"]
  safe?: string
}

// Stable references. FlexContextProvider memoizes on fillJustify, so a new
// object on every column-count change would re-render every cell.
const GRID_CELL_JUSTIFY_TOP: GridCellJustify = Object.freeze({
  fallback: "flex-start",
})
const GRID_CELL_JUSTIFY_CENTER: GridCellJustify = Object.freeze({
  fallback: "center",
  safe: "safe center",
})
const GRID_CELL_JUSTIFY_BOTTOM: GridCellJustify = Object.freeze({
  fallback: "flex-end",
  safe: "safe flex-end",
})

export function gridCellJustifyContent(
  verticalAlignment: BlockProto.GridContainer.VerticalAlignment
): GridCellJustify {
  const { VerticalAlignment } = BlockProto.GridContainer
  switch (verticalAlignment) {
    case VerticalAlignment.CENTER:
      return GRID_CELL_JUSTIFY_CENTER
    case VerticalAlignment.BOTTOM:
      return GRID_CELL_JUSTIFY_BOTTOM
    case VerticalAlignment.TOP:
    default:
      return GRID_CELL_JUSTIFY_TOP
  }
}

export interface StyledGridCellProps {
  verticalAlignment: BlockProto.GridContainer.VerticalAlignment
  showBorder: boolean
  columnSpan?: number
  columnSpanAll?: boolean
  rowSpan?: number
}

export const StyledGridCell = styled.div<StyledGridCellProps>(
  ({
    theme,
    verticalAlignment,
    showBorder,
    columnSpan,
    columnSpanAll,
    rowSpan,
  }) => {
    const { fallback, safe } = gridCellJustifyContent(verticalAlignment)

    return css(
      {
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: fallback,
        minWidth: 0,
        minHeight: 0,
        maxWidth: "100%",
        // Explicit height so stretch children (height: 100%) resolve against
        // the grid area. Stretched grid items otherwise keep height: auto.
        height: "100%",
        // Overflow stays visible here so hover toolbars (position: absolute
        // above a chart) can paint. In-flow scrolling is applied on
        // StyledGridCellBody only when content actually exceeds the cell.
        overflow: "visible",
        ...(showBorder && {
          border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
          borderRadius: theme.radii.default,
          padding: `calc(${theme.spacing.lg} - ${theme.sizes.borderWidth})`,
        }),
        ...(columnSpanAll && { gridColumn: "1 / -1" }),
        ...(!columnSpanAll &&
          columnSpan &&
          columnSpan > 1 && { gridColumn: `span ${columnSpan}` }),
        ...(rowSpan && rowSpan > 1 && { gridRow: `span ${rowSpan}` }),
      },
      // Second declaration so unknown `safe` does not drop the fallback.
      safe &&
        css`
          justify-content: ${safe};
        `
    )
  }
)

/**
 * In-flow body of a grid cell. Fills a definite-height cell so stretch
 * children resolve. `overflow: auto` is applied only when in-flow content
 * exceeds the cell — a permanent scrollport would clip hover toolbars even
 * when nothing scrolls.
 */
export const StyledGridCellBody = styled.div<{
  $scroll: boolean
  $passthrough?: boolean
}>(({ $scroll, $passthrough }) => {
  // Content rows keep the node so toggling row_height does not remount
  // cell contents. The box itself stays out of layout.
  if ($passthrough) {
    return { display: "contents" }
  }

  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    width: "100%",
    minHeight: 0,
    flex: 1,
    height: "100%",
    maxHeight: "100%",
    ...($scroll && { overflowY: "auto", overflowX: "clip" }),
  }
})

interface StyledGridCellContentProps {
  verticalAlignment: BlockProto.GridContainer.VerticalAlignment
  $passthrough?: boolean
}

/**
 * In-flow content of a grid cell. `min-height: min-content` lets this box
 * grow with tall children so ResizeObserver can detect overflow without
 * reading scrollHeight. `height: 100%` keeps stretch children resolving
 * against the cell when content is shorter than the row. Alignment lives
 * here because this box fills the cell; justify-content on the outer cell
 * would otherwise be a no-op.
 */
export const StyledGridCellContent = styled.div<StyledGridCellContentProps>(
  ({ verticalAlignment, $passthrough }) => {
    if ($passthrough) {
      return { display: "contents" }
    }

    const { fallback, safe } = gridCellJustifyContent(verticalAlignment)

    return css(
      {
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: fallback,
        width: "100%",
        height: "100%",
        minHeight: "min-content",
      },
      safe &&
        css`
          justify-content: ${safe};
        `
    )
  }
)
