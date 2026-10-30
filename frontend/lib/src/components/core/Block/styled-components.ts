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

import styled, { type CSSObject } from "@emotion/styled"

import { Block as BlockProto, streamlit } from "@streamlit/protobuf"

import {
  STEP_CONNECTOR_BOTTOM_VAR,
  STEP_FOLLOWED_BY_STEP_SELECTOR,
} from "~lib/components/core/Layout/stepConnector"
import { Direction } from "~lib/components/core/Layout/utils"
import {
  PRINT_CHART_CARD_SELECTOR,
  PRINT_CHART_SELECTOR,
  PRINT_VISIBLE_FILTER,
  printKeepTogetherRules,
} from "~lib/components/shared/printPageBreak"
import { PRINT_UPSCALED_WIDTH } from "~lib/components/shared/usePrintScreenWidth"
import {
  DATAFRAME_PRINT_NOTE_CLASS,
  DATAFRAME_PRINT_TABLE_CLASS,
} from "~lib/components/widgets/DataFrame/printClassNames"
import { STALE_STYLES } from "~lib/theme/consts"
import type { EmotionTheme } from "~lib/theme/types"
import { assertNever } from "~lib/util/assertNever"

/**
 * Vertical-alignment rules for columns and horizontal containers target the
 * wrapper class rather than the two field styled-components, so both widgets
 * stay covered if their inner React Aria composition changes.
 */
const CHECKBOX_WRAPPER_SELECTOR = ".stCheckbox"

/**
 * Marks a bordered card (`st.container(border=True)` or a bordered column)
 * so print can keep a row of cards on one page. A border is drawn with an
 * emotion style, which has no stable selector of its own.
 */
export const PRINT_CARD_CLASS = "stPrintCard"

/**
 * Content that makes a printed column row stack into one column: a
 * dataframe, a static table, or a chart. These keep a width measured on
 * screen and would overflow a narrower printed column.
 *
 * A border alone does not stack the row. Metrics shrink their text to fit,
 * and text wraps, so a row of bordered metric cards stays side by side. An
 * image is `max-width: 100%` and shrinks into the column too.
 */
const PRINT_STACK_TRIGGER = `:is(.stDataFrame, .stTable, ${PRINT_CHART_SELECTOR})`

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
 * Element types whose container takes no space on the printed page (`empty`
 * is always hidden; balloons and snow are hidden in print), so print gap
 * margins skip them.
 */
export const PRINT_HIDDEN_ELEMENT_TYPES = new Set([
  "empty",
  ...GLOBAL_ELEMENTS,
])

/** Marks an element container that takes no space on the printed page. */
export const PRINT_HIDDEN_CLASS = "stPrintHidden"

/** A child followed by at least one sibling that prints. */
const CHILD_BEFORE_PRINTED_SIBLING = `& > :has(~ :not(.${PRINT_HIDDEN_CLASS}))`

/**
 * Replaces flex `gap` with bottom margins when a vertical block prints as
 * `display: block` (`gap` does not apply there). Only a child with a printed
 * sibling after it gets one, so a trailing `st.empty`, balloons, or snow
 * container leaves no extra strip:
 * - Most children get the full gap.
 * - A page link keeps its xs trim, so it gets `gap - xs`.
 * - A zero-height cache spinner cancels its gap with -lg, so it gets
 *   `gap - lg`.
 */
function printBlockGapMargins(
  gapWidth: string | undefined,
  theme: EmotionTheme
): CSSObject {
  if (gapWidth === undefined || gapWidth === theme.spacing.none) {
    return {}
  }
  return {
    [`${CHILD_BEFORE_PRINTED_SIBLING}:not(:has(> .stPageLink)):not(:has(> .stCacheSpinner))`]:
      {
        marginBottom: gapWidth,
      },
    [`${CHILD_BEFORE_PRINTED_SIBLING}:has(> .stPageLink)`]: {
      marginBottom: `calc(${gapWidth} - ${theme.spacing.xs})`,
    },
    [`${CHILD_BEFORE_PRINTED_SIBLING}:has(> .stCacheSpinner)`]: {
      marginBottom: `calc(${gapWidth} - ${theme.spacing.lg})`,
    },
  }
}

function translateGapWidth(
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
  textAlign?: React.CSSProperties["textAlign"]
  alignSelf?: React.CSSProperties["alignSelf"]
  minHeight?: React.CSSProperties["minHeight"]
  maxHeight?: React.CSSProperties["maxHeight"]
  contain?: React.CSSProperties["contain"]
}

export const StyledSpace = styled.div({
  // Styling is handled in StyledElementContainerLayoutWrapper.
  // Space component should fill the container.
  width: "100%",
  height: "100%",
})

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
    alignSelf,
    minHeight,
    maxHeight,
    contain,
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
      // A fixed-height dataframe keeps that height on its container. The
      // print table is taller than the on-screen grid, and a fallback note
      // sits under the canvas, so the container grows with that content
      // instead of letting it paint outside the card.
      [`&:has(.${DATAFRAME_PRINT_TABLE_CLASS}), &:has(.${DATAFRAME_PRINT_NOTE_CLASS})`]:
        {
          height: "auto",
          maxHeight: "none",
          minHeight: 0,
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

/**
 * A column of an `st.columns` row. Print stacking and print containment are
 * applied by the parent row in `StyledFlexContainerBlock`.
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
  /**
   * Whether the block has a definite height to share among its children.
   * Print keeps flex for these so stretch children share the height.
   * When unset, it is inferred from `height`: true for a fixed length, false
   * for auto or a percentage (a percentage is only definite inside a
   * definite-height parent, which this style cannot see).
   */
  hasDefiniteHeight?: boolean
  /**
   * Whether the block's width comes from its contents, because it or an
   * ancestor without a fixed width is content-width. Print does not make
   * its columns size containers, since containment would drop their
   * contents' width and collapse the row.
   */
  isContentSized?: boolean
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
      hasDefiniteHeight,
      isContentSized = false,
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
      //   dataframe, or table stacks its children. Stacked columns stay close
      //   to their screen width; other children are full width.
      // - Columns of a side-by-side row are size containers (unless the row is
      //   content-sized), so a content-width metric can scale to its column.
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
      const releasesPrintHeightForStackedRow: CSSObject =
        keepsPrintFlexForHeight
          ? {
              [`&:has(${PRINT_STACKING_ROW})`]: {
                height: "auto",
                maxHeight: "none",
                overflow: "visible",
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
              [`> .stColumn.${PRINT_CARD_CLASS}`]: {
                [PRINT_CHART_CARD_SELECTOR]: printKeepTogetherRules,
              },
              ...(!isContentSized && {
                [`&:not(:has(${PRINT_STACK_TRIGGER_IN_COLUMN})) > .stColumn`]:
                  {
                    containerType: "inline-size",
                  },
              }),
              // A row of bordered cards that stays side by side prints like
              // one card, so a page break does not cut every card at once.
              [`&:has(> .stColumn.${PRINT_CARD_CLASS}):not(:has(${PRINT_STACK_TRIGGER_IN_COLUMN}))`]:
                printKeepTogetherRules,
              [`&:has(${PRINT_STACK_TRIGGER_IN_COLUMN})`]: {
                display: "block",
                "> .stColumn": {
                  display: "block",
                  // Grow only as far as its chart can scale, so a card does
                  // not stretch across the page around a narrower chart.
                  width: PRINT_UPSCALED_WIDTH,
                  maxWidth: "100%",
                  minWidth: 0,
                  // A print table scales its text to the column, so it
                  // gets the full page width.
                  [`&:has(.${DATAFRAME_PRINT_TABLE_CLASS})`]: {
                    width: "100%",
                  },
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
            ? releasesPrintHeightForStackedRow
            : {
                display: "block",
                ...printBlockGapMargins(gapWidth, theme),
              }),
        ...(border && {
          [PRINT_CHART_CARD_SELECTOR]: printKeepTogetherRules,
        }),
        [`&:has(.${DATAFRAME_PRINT_TABLE_CLASS}), &:has(.${DATAFRAME_PRINT_NOTE_CLASS})`]:
          {
            // A fixed-height container (st.container(height=...)) scrolls
            // its overflow on screen. A print table, or a fallback note
            // stacked under the canvas, can be taller than that height, so
            // the container grows instead of clipping them. Releasing that
            // height makes this the content-height column Chrome collapses,
            // so drop flex when the height was the only reason to keep it.
            // That block box loses `gap`, so it uses the same bottom margins
            // as a content-height container. Vertical alignment has no free
            // space once the height is auto, so only horizontal centering
            // or end alignment stays flex, and its gap still applies.
            ...(keepsPrintFlexForHeight &&
              !keepsPrintFlexForAlignment && {
                display: "block",
                ...printBlockGapMargins(gapWidth, theme),
              }),
            height: "auto",
            maxHeight: "none",
            overflow: "visible",
          },
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
    }
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
      // See StyledFlexContainerBlock: flex height collapses when printing.
      // Fixed and stretch-height wrappers keep flex so their child retains
      // its allocated height.
      ...((height === undefined || height === "auto") &&
        hasDefiniteHeight !== true && {
          display: "block",
        }),
      [`&:has(.${DATAFRAME_PRINT_TABLE_CLASS}), &:has(.${DATAFRAME_PRINT_NOTE_CLASS})`]:
        {
          // A fixed height clips a print table, or a fallback note stacked
          // under the canvas, through the inner container's overflow:auto.
          // Grow this wrapper with it.
          display: "block",
          height: "auto",
          maxHeight: "none",
        },
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
