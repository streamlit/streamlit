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

/**
 * Vertical-alignment rules for columns and horizontal containers target the
 * wrapper class rather than the two field styled-components, so both widgets
 * stay covered if their inner React Aria composition changes.
 */
const CHECKBOX_WRAPPER_SELECTOR = ".stCheckbox"

/**
 * Marks a bordered card (`st.container(border=True)` or a bordered column)
 * so a printed column row can tell a card from a plain container. A border
 * is drawn with an emotion style, which has no stable selector of its own.
 */
export const PRINT_CARD_CLASS = "stPrintCard"

/**
 * Compound match for content that makes a printed column row stack into one
 * column: a card, a dataframe, or a chart. These are the elements' own
 * classes. Test IDs are not used as selectors.
 */
const PRINT_STACK_TRIGGER = `:is(.${PRINT_CARD_CLASS}, .stDataFrame, .stVegaLiteChart, .stPlotlyChart, .stDeckGlJsonChart, .stGraphVizChart, .stEChartsChart)`

/**
 * A chart or dataframe inside a closed tab or a collapsed expander is still
 * mounted. It is not on the printed page, so it does not make the row stack.
 */
const VISIBLE_PRINT_STACK_TRIGGER = `${PRINT_STACK_TRIGGER}:not([data-st-inactive] *):not(details:not([open]) *)`

/**
 * Matches a column that is itself a card, or holds one. A row of compact
 * widgets (metrics, buttons) matches neither and stays side by side instead
 * of lengthening the printed page.
 */
const PRINT_STACK_TRIGGER_SELECTOR = `> .stColumn${PRINT_STACK_TRIGGER}, > .stColumn ${VISIBLE_PRINT_STACK_TRIGGER}`

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
      // A fixed-height dataframe keeps that height on its container. The
      // print table is taller than the on-screen grid, and a fallback note
      // sits under the canvas, so the container grows with that content
      // instead of letting it paint outside the card.
      "&:has(.stDataFramePrintTable), &:has(.stDataFramePrintNote)": {
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
      // Print stacking for columns is set by the parent row.
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
    }) => {
      let gapWidth
      if (gap !== undefined) {
        gapWidth = translateGapWidth(gap, theme)
      }
      const crossAxis = getAlignItems(align)
      const mainAxis = getJustifyContent(justify)
      // display:block drops align-items and justify-content. A container
      // that centers or ends its content keeps flex so print matches the
      // screen. The default start/stretch block is the one whose flex
      // height collapses and paints a chart over the next heading.
      const keepsPrintFlex =
        direction === Direction.VERTICAL &&
        (crossAxis === "center" ||
          crossAxis === "end" ||
          mainAxis === "center" ||
          mainAxis === "end" ||
          mainAxis === "space-between")
      // Chrome's print layout drops the height of a flex or table row, so a
      // chart paints over the next heading. Vertical blocks use normal
      // flow. A column row stacks, and each column takes the full page
      // width, only when it holds a card, chart, or dataframe; a row of
      // compact widgets stays side by side. A bordered card stays on one
      // page so the chart cannot land on the heading below.
      const printRules = {
        ...(direction === Direction.HORIZONTAL
          ? {
              [`&:has(${PRINT_STACK_TRIGGER_SELECTOR})`]: {
                display: "block",
                "> .stColumn": {
                  display: "block",
                  float: "none",
                  clear: "both",
                  width: "100%",
                  maxWidth: "100%",
                  minWidth: 0,
                  ...(gapWidth &&
                    gapWidth !== theme.spacing.none && {
                      "&:not(:last-of-type)": {
                        marginBottom: gapWidth,
                      },
                    }),
                },
              },
            }
          : keepsPrintFlex
            ? {}
            : {
                display: "block",
                // `gap` only applies to a flex box. Margin keeps the
                // space outside the child, so a fixed height is not
                // eaten by border-box padding. Balloons and snow cancel
                // the gap with their own negative margin, and this
                // selector is more specific, so those children are left
                // alone.
                ...(gapWidth &&
                  gapWidth !== theme.spacing.none && {
                    "& > :not(:last-child):not(:has(.stBalloons)):not(:has(.stSnow))":
                      {
                        marginBottom: gapWidth,
                      },
                  }),
              }),
        ...(border && {
          // A landscape page is too short for a chart card to finish in
          // the space left below the previous one, so the card was cut
          // through the middle and the rest of the page stayed empty.
          // Keeping the card whole moves it to the next page instead.
          // Portrait is tall enough for the next card to start on the
          // same page. A dataframe print table can be taller than the
          // page, so that card may still break and repeat its header.
          // A table inside a closed tab is not built, so it does not
          // opt the card out.
          "@media (orientation: landscape)": {
            "&:not(:has(.stDataFramePrintTable))": {
              breakInside: "avoid",
              pageBreakInside: "avoid",
            },
          },
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
        // An empty print block still emits `@media print {}`.
        ...(Object.keys(printRules).length > 0
          ? { "@media print": printRules }
          : {}),
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
  ({ width, height, flex, alignSelf, minHeight, maxHeight }) => ({
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
    // See StyledFlexContainerBlock: flex height collapses when printing.
    "@media print": {
      display: "block",
    },
  })
)
