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

/**
 * Cap on auto-resolved column count so a tiny min_column_width cannot explode
 * tracks. Keep in sync with `_GRID_COLUMNS_MAX` in
 * `lib/streamlit/elements/layouts.py`.
 */
export const GRID_AUTO_COLUMN_CAP = 24

/**
 * Convert a CSS length used by grid layout (px, rem, or "0") to pixels.
 */
export function cssLengthToPx(value: string, rootFontSizePx: number): number {
  if (value === "0" || value === "0px" || value === "0rem") {
    return 0
  }
  if (value.endsWith("px")) {
    return Number.parseFloat(value)
  }
  return Number.parseFloat(value) * rootFontSizePx
}

/**
 * Resolve the outer-cell floor used as a wrap threshold (or no-wrap shrink floor).
 *
 * Proto `min_column_width_px === 0` means `"auto"`: a theme rem token, plus
 * `2 * spacing.lg` when cells are bordered so content width stays equivalent.
 * An explicit pixel int is the outer track width and is not padded for borders.
 */
export function resolveMinColumnWidthPx({
  minColumnWidthPx,
  showBorder,
  autoMinColumnWidthPx,
  borderPaddingPx,
}: {
  minColumnWidthPx: number
  showBorder: boolean
  autoMinColumnWidthPx: number
  borderPaddingPx: number
}): number {
  if (minColumnWidthPx > 0) {
    return minColumnWidthPx
  }
  return showBorder
    ? autoMinColumnWidthPx + borderPaddingPx
    : autoMinColumnWidthPx
}

/**
 * Compute the resolved column count `N` shared by wrapping, last-row track
 * reservation, and span clamping.
 *
 * `maxColumns === 0` is `columns="auto"`. When `wrap` is false, `N` is the
 * declared count. When the container is unmeasured, `fallbackWidthPx` is used
 * so first paint matches the eventual layout (parent width or content max).
 */
export function resolveGridColumnCount({
  availableWidthPx,
  minColumnWidthPx,
  columnGapPx,
  maxColumns,
  wrap,
  fallbackWidthPx,
  cap = GRID_AUTO_COLUMN_CAP,
}: {
  availableWidthPx: number | undefined
  minColumnWidthPx: number
  columnGapPx: number
  maxColumns: number
  wrap: boolean
  fallbackWidthPx: number
  cap?: number
}): number {
  if (!wrap && maxColumns > 0) {
    return maxColumns
  }

  const width =
    availableWidthPx !== undefined && availableWidthPx > 0
      ? availableWidthPx
      : fallbackWidthPx

  const denom = minColumnWidthPx + columnGapPx
  const fitted = denom <= 0 ? cap : Math.floor((width + columnGapPx) / denom)
  const n = Math.max(1, fitted)

  if (maxColumns > 0) {
    return Math.min(maxColumns, n)
  }
  return Math.min(cap, n)
}

/** Clamp an integer column span to the resolved track count. */
export function clampColumnSpan(
  columnSpan: number,
  columnCount: number
): number {
  return Math.max(1, Math.min(columnSpan, columnCount))
}

/**
 * Whether a definite-height grid cell should become a vertical scrollport.
 *
 * Hover toolbars sit `position: absolute` above a chart. `overflow: auto` on
 * an ancestor clips them even when in-flow content fits (no scrollbar). Only
 * enable scrolling when in-flow content actually exceeds the cell.
 */
export function shouldScrollGridCell(
  contentHeight: number,
  cellHeight: number
): boolean {
  return cellHeight > 0 && contentHeight > cellHeight + 1
}

/**
 * Explicit `repeat(N, …)` template so unused last-row tracks still reserve
 * width (unlike CSS `auto-fit`).
 */
export function computeGridTemplateColumns({
  columnCount,
  minColumnWidthPx,
  wrap,
}: {
  columnCount: number
  minColumnWidthPx: number
  wrap: boolean
}): string {
  if (wrap) {
    return `repeat(${columnCount}, minmax(0, 1fr))`
  }
  return `repeat(${columnCount}, minmax(${minColumnWidthPx}px, 1fr))`
}
