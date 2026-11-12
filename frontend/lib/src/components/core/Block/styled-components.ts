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

import { css, keyframes } from "@emotion/react"
import styled, { type CSSObject } from "@emotion/styled"

import { Block as BlockProto, streamlit } from "@streamlit/protobuf"

import {
  STEP_CONNECTOR_BOTTOM_VAR,
  STEP_FOLLOWED_BY_STEP_SELECTOR,
} from "~lib/components/core/Layout/stepConnector"
import { Direction } from "~lib/components/core/Layout/utils"
import { ANIMATION_STYLES as SKELETON_PULSE_STYLES } from "~lib/components/elements/Skeleton/styled-components"
import {
  PRINT_CHART_CARD_SELECTOR,
  PRINT_VISIBLE_FILTER,
  printKeepTogetherRules,
} from "~lib/components/shared/printPageBreak"
import { getBareEmbedOverlayToolbarPadding } from "~lib/components/shared/Toolbar/overlayToolbarSpacing"
import { DATAFRAME_PRINT_TABLE_CLASS } from "~lib/components/widgets/DataFrame/printClassNames"
import { STALE_STYLES } from "~lib/theme/consts"
import type { EmotionTheme } from "~lib/theme/types"
import { assertNever } from "~lib/util/assertNever"

import { PrintLayout } from "./ElementContainerConfig"
import { computeGridTemplateColumns } from "./gridUtils"

/**
 * Vertical-alignment rules for columns and horizontal containers target the
 * wrapper class rather than the two field styled-components, so both widgets
 * stay covered if their inner React Aria composition changes.
 */
const CHECKBOX_WRAPPER_SELECTOR = ".stCheckbox"

/**
 * Marks a bordered column so print can keep its row of bordered columns on
 * one page. A border is drawn with an emotion style, which has no stable
 * selector of its own.
 */
export const PRINT_BORDERED_COLUMN_CLASS = "stPrintBorderedColumn"

/**
 * Content that makes a printed column row stack into one column: an element
 * that keeps a width measured on screen (see `PrintLayout`). A border alone
 * does not stack the row, so a row of bordered metric cards stays side by
 * side.
 */
const PRINT_STACK_TRIGGER = `:is(.${PrintLayout.FIXED_WIDTH}, .${PrintLayout.GRAPHIC})`

/**
 * Relative selector for a dataframe, table, or chart that prints inside a
 * direct child column. It has no leading `&`, so wrap it in `&:has(...)`.
 */
const PRINT_STACK_TRIGGER_IN_COLUMN = `> .stColumn ${PRINT_STACK_TRIGGER}${PRINT_VISIBLE_FILTER}`

/**
 * Emotion selector for this horizontal container when it is not an
 * `st.columns` row and it holds a dataframe, table, or chart on the printed
 * page. The leading `&` is this flex container.
 */
const PRINT_STACK_HORIZONTAL_CONTAINER = `&:not(:has(> .stColumn)):has(${PRINT_STACK_TRIGGER}${PRINT_VISIBLE_FILTER})`

/**
 * Relative selector for a descendant column row or horizontal container that
 * stacks in print because it holds a dataframe, table, or chart. It has no
 * leading `&`, so wrap it in `&:has(...)`.
 */
const PRINT_STACKING_ROW = `.stHorizontalBlock ${PRINT_STACK_TRIGGER}${PRINT_VISIBLE_FILTER}`

const GLOBAL_ELEMENTS = new Set(["balloons", "snow"])

/**
 * Replaces flex `gap` with bottom margins when a vertical block prints as
 * `display: block` (`gap` does not apply there).
 */
function printBlockGapMargins(
  gapWidth: string | undefined,
  theme: EmotionTheme
): CSSObject {
  if (gapWidth === undefined || gapWidth === theme.spacing.none) {
    return {}
  }
  return {
    "& > :not(:last-child)": {
      marginBottom: gapWidth,
    },
  }
}

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
  /** Whether this is a retained copy of a displaced prior-run element. */
  isRetained?: boolean
  width: React.CSSProperties["width"]
  height: React.CSSProperties["height"]
  elementType: string
  overflow: React.CSSProperties["overflow"]
  flex?: React.CSSProperties["flex"]
  minWidth?: React.CSSProperties["minWidth"]
  textAlign?: React.CSSProperties["textAlign"]
  alignSelf?: React.CSSProperties["alignSelf"]
  minHeight?: React.CSSProperties["minHeight"]
  maxHeight?: React.CSSProperties["maxHeight"]
  contain?: React.CSSProperties["contain"]
  /**
   * Whether a skeleton overlay covers this element. The element then skips
   * the stale fade, which would also fade the overlay.
   */
  hasPendingSkeleton?: boolean
}

export const StyledSpace = styled.div({
  // Styling is handled in StyledElementContainerLayoutWrapper.
  // Space component should fill the container.
  width: "100%",
  height: "100%",
})

/**
 * A retained element stays mounted but leaves the layout, unless it holds
 * focus. Hiding a focused control would blur it (committing a dirty text
 * input) in Chromium and Firefox, and would strand focus in WebKit.
 */
const RETAINED_STYLES = {
  "&:not(:focus-within)": {
    display: "none",
  },
}

export const StyledElementContainer = styled.div<StyledElementContainerProps>(
  ({
    theme,
    isStale,
    isRetained,
    width,
    height,
    elementType,
    overflow,
    flex,
    minWidth,
    textAlign,
    alignSelf,
    minHeight,
    maxHeight,
    contain,
    hasPendingSkeleton,
  }) => ({
    width,
    height,
    alignSelf,
    minHeight,
    maxHeight,
    ...(contain !== undefined ? { contain } : {}),
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
      ...(GLOBAL_ELEMENTS.has(elementType)
        ? {
            // Hide balloons and snow in print. Their negative margin only
            // cancels the flex gap, so the print gap margin would otherwise
            // leave a blank strip.
            display: "none",
          }
        : {}),
      // A dataframe print table can be taller than the on-screen canvas
      // box. Drop the reserved height, flex basis, and size containment so
      // the next element is not covered.
      [`&:has(.${DATAFRAME_PRINT_TABLE_CLASS})`]: {
        height: "auto",
        maxHeight: "none",
        flex: "0 0 auto",
        contain: "none",
      },
    },

    ":has(> .stCacheSpinner)": {
      height: theme.spacing.none,
      overflow: "visible",
      visibility: "visible",
      marginBottom: `-${theme.spacing.lg}`,
      zIndex: theme.zIndices.cacheSpinner,
    },

    ":has(> .stPageLink)": {
      // Trims the flex gap. Print replaces the gap with margins, which these
      // negative margins would cancel, so the next element would overlap.
      "@media screen": {
        marginTop: `-${theme.spacing.xs}`,
        marginBottom: `-${theme.spacing.xs}`,
      },
    },

    ...(isStale &&
      elementType !== "skeleton" &&
      hasPendingSkeleton !== true &&
      STALE_STYLES),
    ...(isRetained === true && RETAINED_STYLES),
    ...(elementType === "empty"
      ? {
          // Use display: none for empty elements to avoid the flexbox gap.
          display: "none",
        }
      : {}),
    // A spinner shown as the skeleton's label leaves its own slot empty. Hide
    // that slot so it doesn't leave a gap.
    ...(elementType === "spinner" && { "&:empty": { display: "none" } }),
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

/**
 * A column of an `st.columns` row. The parent row in
 * `StyledFlexContainerBlock` stacks its columns in print when needed. A
 * bordered column with a chart avoids page breaks on its own.
 */
export const StyledColumn = styled.div<StyledColumnProps>(
  ({ theme, weight, gap, showBorder, verticalAlignment, $wrap = true }) => {
    const { VerticalAlignment } = BlockProto.Column
    const percentage = weight * 100
    const gapWidth = translateGapWidth(gap, theme)
    const width =
      gapWidth === theme.spacing.none
        ? `${percentage}%`
        : `calc(${percentage}% - ${gapWidth})`

    // Columns don't shift themselves for vertical alignment: the row stretches
    // each column (so bordered columns match), and ContainerContentsWrapper
    // aligns the content inside it.
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
      ...(showBorder && {
        border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
        borderRadius: theme.radii.default,
        padding: `calc(${theme.spacing.lg} - ${theme.sizes.borderWidth})`,
        "@media print": {
          [PRINT_CHART_CARD_SELECTOR]: printKeepTogetherRules,
        },
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
  /**
   * Whether the block has a definite height to share among its children.
   * Print keeps flex for these so stretch children share the height.
   * When unset, it is inferred from `height`: true for a fixed length, false
   * for auto or a percentage (a percentage is only definite inside a
   * definite-height parent, which this style cannot see).
   */
  hasDefiniteHeight?: boolean
  /** Whether the block positions a skeleton overlay over its content. */
  $canShowOverlay?: boolean
  /**
   * Whether the block shows its inline skeleton. Its other children have no
   * visible content yet, so they leave the layout instead of adding gaps.
   */
  $showsInlineSkeleton?: boolean
}

function isFixedLengthHeight(
  height: React.CSSProperties["height"] | undefined
): boolean {
  return (
    height !== undefined &&
    height !== "auto" &&
    !(typeof height === "string" && height.endsWith("%"))
  )
}

interface StyledLoadingBlockSkeletonProps {
  height?: CSSProperties["height"]
  /** Whether the skeleton fills its loading block, which stretches. */
  $fillsBlock: boolean
}

/**
 * The inline skeleton of a loading block. Defined before
 * `StyledFlexContainerBlock`, which references it in a selector.
 */
export const StyledLoadingBlockSkeleton =
  styled.div<StyledLoadingBlockSkeletonProps>(
    ({ theme, height, $fillsBlock }) => ({
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      ...($fillsBlock
        ? { flex: "1 1 auto", minHeight: theme.sizes.minElementHeight }
        : { height, flexShrink: 0 }),
    })
  )

export const StyledFlexContainerBlock =
  styled.div<StyledFlexContainerBlockProps>(
    ({
      theme,
      direction,
      gap,
      flex,
      $wrap = false,
      height,
      border,
      align,
      justify,
      overflow,
      overflowX,
      minHeight,
      $fillJustify,
      hasDefiniteHeight,
      $canShowOverlay = false,
      $showsInlineSkeleton = false,
    }) => {
      let gapWidth
      if (gap !== undefined) {
        gapWidth = translateGapWidth(gap, theme)
      }
      const crossAxis = getAlignItems(align)
      // Print layout rules. Chrome's print layout drops the height of a
      // content-height flex column, so a chart would paint over the next
      // element:
      // - A vertical block prints as display:block, unless it centers or
      //   end-aligns its children (block has no equivalent) or has a
      //   definite height that stretch children share. Vertical alignment
      //   alone does not keep flex: a content-height column has no free
      //   space to distribute.
      // - A column row or horizontal container that holds a visible chart,
      //   dataframe, or table stacks its children. Stacked columns print full
      //   width; other children keep their width, capped to the container. A
      //   chart keeps the width it rendered at on screen, capped to its column.
      // - A bordered card with a chart, and a side-by-side row of bordered
      //   columns, avoid page breaks.
      const keepsPrintFlexForAlignment =
        direction === Direction.VERTICAL &&
        (crossAxis === "center" || crossAxis === "end")
      const keepsPrintFlexForHeight =
        direction === Direction.VERTICAL &&
        (hasDefiniteHeight ?? isFixedLengthHeight(height))
      const keepsPrintFlex =
        keepsPrintFlexForAlignment || keepsPrintFlexForHeight
      // A height that fit a side-by-side row cuts off the row once it
      // stacks, and print cannot scroll, so the block grows to fit it. It
      // prints as a block box then, unless it centers or end-aligns.
      const stackedRowHeightReleaseRules: CSSObject = keepsPrintFlexForHeight
        ? {
            [`&:has(${PRINT_STACKING_ROW})`]: {
              height: "auto",
              maxHeight: "none",
              overflow: "visible",
              // A stretch-height element shared the fixed height through
              // `height: 100%` and size containment. Without containment
              // it takes its content's height instead of collapsing.
              [`& > ${StyledElementContainer}`]: {
                contain: "none",
              },
              ...(!keepsPrintFlexForAlignment && {
                display: "block",
                ...printBlockGapMargins(gapWidth, theme),
              }),
            },
          }
        : {}
      const printRules: CSSObject = {
        ...(direction === Direction.HORIZONTAL
          ? {
              // A row of bordered cards that stays side by side prints like
              // one card, so a page break does not cut every card at once.
              [`&:has(> .stColumn.${PRINT_BORDERED_COLUMN_CLASS}):not(:has(${PRINT_STACK_TRIGGER_IN_COLUMN}))`]:
                printKeepTogetherRules,
              [`&:has(${PRINT_STACK_TRIGGER_IN_COLUMN})`]: {
                display: "block",
                "> .stColumn": {
                  display: "block",
                  width: "100%",
                  minWidth: 0,
                  ...(gapWidth &&
                    gapWidth !== theme.spacing.none && {
                      "&:not(:last-of-type)": {
                        marginBottom: gapWidth,
                      },
                    }),
                  // A stacked column has no definite height, so its
                  // 100%-height content block would collapse as a flex
                  // column and the chart would paint over the next heading.
                  // Print it as a block and keep the column's small gap as
                  // margins.
                  "> .stVerticalBlock": {
                    display: "block",
                    ...printBlockGapMargins(
                      translateGapWidth(
                        { gapSize: streamlit.GapSize.SMALL },
                        theme
                      ),
                      theme
                    ),
                  },
                },
              },
              // A horizontal container with a chart stacks the same way.
              // Its children print as block boxes, because a content-height
              // flex column collapses in Chrome print. Stretch children fill
              // the container; fixed and content widths are kept, capped to
              // the container. A fixed height that fit the row would cut off
              // the stacked children, so the container grows to fit them
              // instead of scrolling.
              [PRINT_STACK_HORIZONTAL_CONTAINER]: {
                display: "block",
                height: "auto",
                overflow: "visible",
                "> *": {
                  maxWidth: "100%",
                  minWidth: 0,
                },
                ...printBlockGapMargins(gapWidth, theme),
              },
            }
          : keepsPrintFlex
            ? stackedRowHeightReleaseRules
            : {
                display: "block",
                ...printBlockGapMargins(gapWidth, theme),
              }),
        ...(border && {
          [PRINT_CHART_CARD_SELECTOR]: printKeepTogetherRules,
        }),
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
        ...($canShowOverlay && { position: "relative" }),
        ...($showsInlineSkeleton && {
          [`& > :not(${StyledLoadingBlockSkeleton})`]: { display: "none" },
        }),
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
        ...(direction === Direction.HORIZONTAL &&
          align === BlockProto.FlexContainer.Align.ALIGN_END && {
            // Align direct-child checkboxes/toggles with input widgets, matching
            // bottom-aligned columns. Nested containers are not matched.
            [`& > ${StyledElementContainer} > ${CHECKBOX_WRAPPER_SELECTOR}`]: {
              marginBottom: theme.spacing.sm,
            },
          }),
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
        "@media print": printRules,
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
  alignSelf?: React.CSSProperties["alignSelf"]
  minHeight?: React.CSSProperties["minHeight"]
  maxHeight?: React.CSSProperties["maxHeight"]
  /**
   * True for a stretch-height wrapper in a definite-height parent. Print
   * keeps flex for it, like a fixed height, so it still fills the parent.
   */
  hasDefiniteHeight?: boolean
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
  ({
    width,
    height,
    flex,
    alignSelf,
    minHeight,
    maxHeight,
    hasDefiniteHeight,
  }) => ({
    display: "flex",
    // This shouldn't matter since this is a wrapper and should only have one child.
    // However, adding it here to be explicit.
    flexDirection: "column",
    width,
    maxWidth: "100%",
    minWidth: "1rem",
    height,
    flex,
    alignSelf,
    minHeight,
    maxHeight,
    "@media print": {
      // Chrome print drops the height of a content-height flex column (see
      // StyledFlexContainerBlock), so this wrapper prints as a block. A
      // fixed-height wrapper, or a stretch wrapper in a definite-height parent,
      // keeps flex so its child keeps the height it was given.
      ...((height === undefined || height === "auto") &&
        hasDefiniteHeight !== true && {
          display: "block",
        }),
      // A row that stacks in print outgrows a fixed height that fit it side
      // by side, whether the height is on the row's own container or on a
      // container around it, so the wrapper follows its content's height.
      [`&:has(${PRINT_STACKING_ROW})`]: {
        display: "block",
        flex: "0 0 auto",
        height: "auto",
        maxHeight: "none",
      },
    },
  })
)

/**
 * Delay before a skeleton covers previous content, or before a slot from an
 * earlier run shows its inline skeleton. Matches the stale fade, so a fast
 * rerun replaces the content before either shows.
 */
export const PENDING_SKELETON_DELAY_MS = 500

const pendingSkeletonReveal = keyframes({
  from: { opacity: 0, visibility: "hidden" },
  to: { opacity: 1, visibility: "visible" },
})

/** Hides previous content, which stays mounted, under an opaque background. */
export const StyledPendingSkeletonOverlay = styled.div(({ theme }) => ({
  position: "absolute",
  inset: 0,
  zIndex: theme.zIndices.skeletonOverlay,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: theme.radii.default,
  backgroundColor: theme.colors.bgColor,
  opacity: 0,
  visibility: "hidden",
  animation: `${pendingSkeletonReveal} 150ms ease-in ${PENDING_SKELETON_DELAY_MS}ms forwards`,
}))

/** The pulsing skeleton surface of a placeholder. */
export const StyledSkeletonSurface = styled.div(({ theme }) => ({
  position: "absolute",
  inset: 0,
  borderRadius: theme.radii.default,
  backgroundColor: theme.colors.darkenedBgMix15,
  ...SKELETON_PULSE_STYLES,
}))

/** Text shown on a skeleton, taken from a spinner in its slot. */
export const StyledSkeletonLabel = styled.div(({ theme }) => ({
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.sm,
  padding: theme.spacing.lg,
  textAlign: "center",
}))

export interface StyledGridContainerBlockProps {
  columnCount: number
  minColumnWidthPx: number
  $wrap: boolean
  rowGap: streamlit.GapConfig.$Properties | undefined
  columnGap: streamlit.GapConfig.$Properties | undefined
  rowHeightMode: BlockProto.GridContainer.RowHeightMode
  rowHeightPx?: number
  $dense?: boolean
  /**
   * When true, this element is the horizontal scrollport. Bounded-height
   * grids apply that overflow on StyledGridScrollBody instead. Only set
   * once tracks are wider than the box.
   */
  $horizontalScroll?: boolean
  /**
   * Room for a chart or dataframe toolbar above the first row. A horizontal
   * scrollport clips the cross axis; this padding sits inside that clip.
   * Bounded grids set it here even though the scrollport is the parent.
   */
  $overlayClearance?: boolean
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
      rowHeightMode,
      rowHeightPx,
      $dense,
      $horizontalScroll = false,
      $overlayClearance = false,
    }) => {
      const rowGapWidth = translateGapWidth(rowGap, theme)
      const columnGapWidth = translateGapWidth(columnGap, theme)
      // The scrollport clips anything outside its padding box. Top padding
      // as tall as the toolbar keeps chart and dataframe toolbars visible.
      // A negative margin would overlap the element above and take its
      // clicks. The bottom padding only has to clear a focus ring.
      const reserveToolbarSpace = $horizontalScroll || $overlayClearance

      // Pixel row_height is a fixed track. row_height="content" sizes each
      // row to its tallest cell.
      const gridAutoRows =
        rowHeightMode === BlockProto.GridContainer.RowHeightMode.FIXED &&
        rowHeightPx
          ? `${rowHeightPx}px`
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
        gap: `${rowGapWidth} ${columnGapWidth}`,
        gridTemplateColumns: computeGridTemplateColumns({
          columnCount,
          minColumnWidthPx,
          wrap: $wrap,
        }),
        gridAutoRows,
        ...(reserveToolbarSpace && {
          paddingTop: getBareEmbedOverlayToolbarPadding(theme),
          paddingBottom: theme.sizes.focusRingWidth,
        }),
        // wrap=False keeps the declared track count and scrolls locally,
        // but only once the tracks are wider than this box.
        ...($horizontalScroll && {
          overflowX: "auto" as const,
          // `visible` computes to `auto` and would clip the toolbar. `hidden`
          // does not open a vertical scrollbar. The padding above is part of
          // this auto height, so in-flow rows stay inside the clip.
          overflowY: "hidden" as const,
        }),
        // Dense packing mode fills gaps by reordering items
        ...($dense === true && { gridAutoFlow: "dense" }),
      }
    }
  )

/**
 * Pixel- or rem-height port around a content-sized grid. Fills the layout
 * wrapper and becomes a vertical scrollport only when in-flow tracks exceed
 * it, so chart hover toolbars stay visible when nothing actually overflows.
 * Once it scrolls, top padding keeps the first row's toolbars inside the
 * clip. Content and stretch heights keep the node mounted but out of layout.
 */
export const StyledGridScrollBody = styled.div<{
  $scroll: boolean
  $horizontalScroll: boolean
  $bounded: boolean
}>(({ theme, $scroll, $horizontalScroll, $bounded }) => {
  // Content and stretch heights keep this node so a later pixel or rem
  // height does not remount the grid. `display: contents` leaves layout
  // unchanged. Stretch grows with the shared container rule instead of
  // scrolling inside this port.
  if (!$bounded) {
    return { display: "contents" }
  }

  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    width: "100%",
    // The track floor lives on the content measure, not on this port.
    // min-width: 0 keeps the port at the layout slot so its border box
    // stays a stable available-width measurement.
    minWidth: 0,
    minHeight: 0,
    flex: 1,
    height: "100%",
    maxHeight: "100%",
    ...($scroll && {
      overflowY: "auto" as const,
      overflowX: $horizontalScroll ? ("auto" as const) : ("clip" as const),
      // A horizontally scrolling grid already pads itself for the toolbar.
      // The padding is inside this border box, so it does not change the
      // port height that decides whether to scroll.
      ...(!$horizontalScroll && {
        paddingTop: getBareEmbedOverlayToolbarPadding(theme),
      }),
    }),
    ...(!$scroll &&
      $horizontalScroll && {
        overflowX: "auto" as const,
        // Same cross-axis clip as the unbounded grid. Toolbar room lives on
        // the grid, inside this port, so this axis does not scroll.
        overflowY: "hidden" as const,
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
  if ($passthrough === true) {
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
  $showBorder: boolean
  $columnSpan?: number
  $columnSpanAll?: boolean
  $rowSpan?: number
  /** Whether this cell holds a retained copy of a displaced element. */
  $isRetained?: boolean
}

export const StyledGridCell = styled.div<StyledGridCellProps>(
  ({
    theme,
    verticalAlignment,
    $showBorder,
    $columnSpan,
    $columnSpanAll,
    $rowSpan,
    $isRetained,
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
        ...($showBorder && {
          border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
          borderRadius: theme.radii.default,
          padding: `calc(${theme.spacing.lg} - ${theme.sizes.borderWidth})`,
        }),
        ...($columnSpanAll === true && { gridColumn: "1 / -1" }),
        ...($columnSpanAll !== true &&
          $columnSpan &&
          $columnSpan > 1 && { gridColumn: `span ${$columnSpan}` }),
        ...($rowSpan && $rowSpan > 1 && { gridRow: `span ${$rowSpan}` }),
        // A hidden cell takes no track, so later cells keep their places.
        ...($isRetained === true && RETAINED_STYLES),
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
 * when nothing scrolls. Once it scrolls, top padding keeps the first
 * child's toolbar inside the clip.
 */
export const StyledGridCellBody = styled.div<{
  $scroll: boolean
  $passthrough?: boolean
}>(({ theme, $scroll, $passthrough }) => {
  // Content rows keep the node so toggling row_height does not remount
  // cell contents. The box itself stays out of layout.
  if ($passthrough === true) {
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
      overflowY: "auto",
      overflowX: "clip",
      paddingTop: getBareEmbedOverlayToolbarPadding(theme),
    }),
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
 * against the cell when content is shorter than the row. In pixel-height
 * rows this box fills the cell, so alignment must live here. In content
 * rows this box is `display: contents` and `StyledGridCell` aligns the
 * children instead.
 */
export const StyledGridCellContent = styled.div<StyledGridCellContentProps>(
  ({ verticalAlignment, $passthrough }) => {
    if ($passthrough === true) {
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
