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

import {
  createContext,
  FC,
  PropsWithChildren,
  RefObject,
  useCallback,
  useMemo,
  useState,
} from "react"

import { BlockNode } from "~lib/AppNode"
import { useWindowDimensionsContext } from "~lib/components/shared/WindowDimensions/useWindowDimensionsContext"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { convertRemToPx } from "~lib/theme/utils"

/**
 * Smallest width a column can be dragged down to, in pixels.
 *
 * A wrapping row deliberately gives its columns no CSS `min-width`:
 * `StyledColumn` sizes them as `calc(weight% - gap)`, so those widths only add
 * up to a full row as long as the weights add up to 1. A `min-width` would let
 * a clamped column claim more than its weight, overflow the row's flex line,
 * and wrap the last column onto a second row. A `wrap=false` row scrolls
 * instead of wrapping and does pin its columns to a `min-width`, so it raises
 * its drag floor to match — see `ResizableColumnsProvider`.
 */
export const MIN_COLUMN_WIDTH_PX = 64

/** Width change applied by a single arrow key press, in pixels. */
export const KEYBOARD_RESIZE_STEP_PX = 10

/**
 * Decimals the stored width fractions are rounded to. Rounding bounds how many
 * distinct Emotion class names a drag can generate.
 */
const FRACTION_DECIMALS = 4

const FRACTION_FACTOR = 10 ** FRACTION_DECIMALS

function roundFraction(fraction: number): number {
  return Math.round(fraction * FRACTION_FACTOR) / FRACTION_FACTOR
}

/**
 * Rounds a fraction down to `FRACTION_DECIMALS`, so that a pair of columns can
 * never end up wider than it started.
 */
function floorFraction(fraction: number): number {
  return Math.floor(fraction * FRACTION_FACTOR) / FRACTION_FACTOR
}

/**
 * Geometry and width limits of a column row, resolved when a resize gesture
 * starts.
 */
export interface RowMetrics {
  /** Width of the row in pixels, or 0 when it can't be measured. */
  width: number
  /** Gap between two adjacent columns in pixels. */
  gapPx: number
  /**
   * Smallest width a column of this row may be dragged to, in pixels. Larger
   * than `MIN_COLUMN_WIDTH_PX` when the row's columns already carry a wider
   * CSS `min-width`.
   */
  minColumnWidthPx: number
}

export interface ResizeColumnsParams {
  /** Index of the column on the left of the boundary being moved. */
  index: number
  /** Distance the pointer travelled since the gesture started, in pixels. */
  deltaPx: number
  /** Geometry of the row the columns live in. */
  row: RowMetrics
  /**
   * Width fractions the gesture started from. Resolving every move against the
   * gesture's starting point (rather than the previous move) keeps a drag
   * absolute, so dragging back out of the minimum-width clamp works.
   */
  baseFractions: number[]
}

/**
 * Returns the smallest fraction of the row a column may be given.
 *
 * A column of fraction `f` is laid out as `calc(f * 100% - gap)` and then grows
 * by its share of the row's one gap of leftover space, so it ends up
 * `f * width - gap + gap / columnCount` wide. This inverts that to the fraction
 * at which a column renders exactly `minColumnWidthPx` wide, which also keeps
 * the laid-out width non-negative at large gaps.
 */
function getMinFraction(
  { width, gapPx, minColumnWidthPx }: RowMetrics,
  columnCount: number
): number {
  const gapCompensation = (gapPx * (columnCount - 1)) / columnCount
  return (minColumnWidthPx + gapCompensation) / width
}

/**
 * Moves the boundary between the columns at `index` and `index + 1` by
 * `deltaPx`, leaving all other columns untouched.
 *
 * Both columns stay at or above the row's minimum column width, and the pair
 * keeps its combined fraction to within one rounding step: the right-hand
 * column is floored so the row can never overflow, and `flex-grow` reabsorbs
 * the sliver that leaves behind.
 *
 * @returns The updated fractions, or `baseFractions` unchanged when the gesture
 * cannot be applied (unmeasurable row, no room for both minimum widths, or a
 * delta too small to move anything).
 */
export function resizeColumnFractions({
  index,
  deltaPx,
  row,
  baseFractions,
}: ResizeColumnsParams): number[] {
  const leftFraction = baseFractions[index]
  const rightFraction = baseFractions[index + 1]
  if (
    row.width <= 0 ||
    leftFraction === undefined ||
    rightFraction === undefined
  ) {
    return baseFractions
  }

  const pairFraction = leftFraction + rightFraction
  const minFraction = getMinFraction(row, baseFractions.length)
  if (pairFraction < 2 * minFraction) {
    // The pair is too narrow to honor both minimum widths, so leave it alone
    // rather than pushing one column below the minimum.
    return baseFractions
  }

  const nextLeftFraction = Math.min(
    Math.max(roundFraction(leftFraction + deltaPx / row.width), minFraction),
    pairFraction - minFraction
  )
  // Rounded down rather than to nearest: if both sides of the pair round up,
  // the fractions add up to more than 1, which overflows the row's flex line
  // and wraps the last column onto a second row.
  const nextRightFraction = floorFraction(pairFraction - nextLeftFraction)
  if (
    nextLeftFraction === leftFraction &&
    nextRightFraction === rightFraction
  ) {
    return baseFractions
  }

  const nextFractions = [...baseFractions]
  nextFractions[index] = nextLeftFraction
  nextFractions[index + 1] = nextRightFraction
  return nextFractions
}

export interface ResizableColumnsContextValue {
  /** Position of each column node within its row, keyed by node identity. */
  columnIndexes: Map<BlockNode, number>
  /**
   * Width fraction currently applied to each column: the user's dragged widths
   * if there are any, otherwise the `spec` proportions.
   */
  columnFractions: number[]
  /** Measures the row's geometry; returns a width of 0 when unmeasurable. */
  measureRow: () => RowMetrics
  /** Moves the boundary between the columns at `index` and `index + 1`. */
  resizeColumns: (params: ResizeColumnsParams) => void
  /** Restores every column in the row to its `spec` proportion. */
  resetColumns: () => void
}

export const ResizableColumnsContext =
  createContext<ResizableColumnsContextValue | null>(null)
ResizableColumnsContext.displayName = "ResizableColumnsContext"

interface ResizableColumnsProviderProps {
  /** The row's columns, in the order they are rendered. */
  columnNodes: BlockNode[]
  /** Whether the row is allowed to wrap, i.e. to stack on narrow viewports. */
  wrap: boolean
  /** The row's element, which a drag distance is measured relative to. */
  containerRef: RefObject<HTMLElement>
}

/**
 * Owns the dragged widths of one `st.columns` row and exposes them to the
 * columns rendered below it.
 *
 * Widths are kept as fractions of the row (the same unit as
 * `Block.Column.weight`) rather than pixels, so a resized row still responds to
 * container and window resizes.
 *
 * The context value is `null` while the columns are stacked, which removes the
 * resize handles from the DOM without discarding the widths the user picked.
 */
export const ResizableColumnsProvider: FC<
  PropsWithChildren<ResizableColumnsProviderProps>
> = ({ children, columnNodes, wrap, containerRef }) => {
  const theme = useEmotionTheme()
  const { innerWidth } = useWindowDimensionsContext()
  const [widthFractions, setWidthFractions] = useState<number[] | null>(null)

  const specFractions = useMemo(
    () => columnNodes.map(node => node.deltaBlock.column?.weight ?? 0),
    [columnNodes]
  )

  // A rerun that keeps the same column configuration must keep the widths the
  // user dragged, but a different `spec` (or column count) invalidates them.
  // Adjusting state during render avoids the extra committed render an effect
  // would cost. See https://react.dev/reference/react/useState
  const columnConfigKey = specFractions.join(",")
  const [prevColumnConfigKey, setPrevColumnConfigKey] =
    useState(columnConfigKey)
  if (prevColumnConfigKey !== columnConfigKey) {
    setPrevColumnConfigKey(columnConfigKey)
    setWidthFractions(null)
  }

  const columnIndexes = useMemo(
    () => new Map(columnNodes.map((node, index) => [node, index])),
    [columnNodes]
  )

  // Columns of a `wrap=false` row are pinned to a CSS `min-width`, so dragging
  // below it would only shrink the fraction while the rendered width stays put.
  const minColumnWidthPx = wrap
    ? MIN_COLUMN_WIDTH_PX
    : Math.max(MIN_COLUMN_WIDTH_PX, convertRemToPx(theme.spacing.sixXL))

  const measureRow = useCallback((): RowMetrics => {
    const row = containerRef.current
    if (!row) {
      return { width: 0, gapPx: 0, minColumnWidthPx }
    }
    /* eslint-disable streamlit-custom/no-force-reflow-access -- Measured once per resize gesture to turn the pointer's pixel delta into a width fraction. */
    const width = row.getBoundingClientRect().width
    const { columnGap } = window.getComputedStyle(row)
    /* eslint-enable streamlit-custom/no-force-reflow-access */
    // `column-gap` resolves to "normal" when no gap is set, which is 0 for flex.
    return {
      width,
      gapPx: Number.parseFloat(columnGap) || 0,
      minColumnWidthPx,
    }
  }, [containerRef, minColumnWidthPx])

  const resizeColumns = useCallback((params: ResizeColumnsParams) => {
    const nextFractions = resizeColumnFractions(params)
    if (nextFractions !== params.baseFractions) {
      setWidthFractions(nextFractions)
    }
  }, [])

  const resetColumns = useCallback(() => {
    setWidthFractions(null)
  }, [])

  // Columns only stack below the breakpoint when the row is allowed to wrap;
  // a `wrap=False` row scrolls horizontally instead and stays resizable. The
  // breakpoint has to be a px value to be comparable to the viewport width; it
  // is the same one StyledColumn's stacking media query uses.
  const isStacked =
    wrap && innerWidth <= parseInt(theme.breakpoints.columns, 10)

  const value = useMemo<ResizableColumnsContextValue | null>(
    () =>
      isStacked
        ? null
        : {
            columnIndexes,
            // A gesture that started before a rerun changed the column count
            // resolves against the widths it was started with, so it can hand
            // back a fractions array of the wrong length. Applying it would
            // leave the weights adding up to more than 1, which wraps the last
            // column onto a second line for as long as the widths are kept.
            columnFractions:
              widthFractions?.length === specFractions.length
                ? widthFractions
                : specFractions,
            measureRow,
            resizeColumns,
            resetColumns,
          },
    [
      isStacked,
      columnIndexes,
      widthFractions,
      specFractions,
      measureRow,
      resizeColumns,
      resetColumns,
    ]
  )

  return (
    <ResizableColumnsContext.Provider value={value}>
      {children}
    </ResizableColumnsContext.Provider>
  )
}
