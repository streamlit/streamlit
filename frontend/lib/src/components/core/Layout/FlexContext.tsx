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
  type CSSProperties,
  type FC,
  type PropsWithChildren,
  useMemo,
} from "react"

import { Direction } from "./utils"

export interface IFlexContext {
  direction: Direction | undefined
  isInHorizontalLayout: boolean
  /**
   * True when widgets here are direct layout children of an `st.columns`
   * column or an `st.grid` cell (including `grid.cell()`). Nested layout
   * providers create a new context and leave this false. Transparent
   * blocks do not create a provider, so they keep the parent value.
   */
  isDirectlyInColumn: boolean
  isInRoot: boolean
  /**
   * Whether the nearest flex container allows children to wrap onto additional
   * rows. Defaults to true when unset for backwards compatibility.
   */
  wrap?: boolean
  /**
   * The width of the parent container in pixels, if the container has a fixed
   * pixel width set via widthConfig.pixelWidth. Undefined otherwise.
   */
  parentWidth?: number
  /**
   * Whether this element is inside a content-width container in its ancestry.
   * Returns true if there's a content-width container ancestor.
   * Returns false if there's a fixed-width container that is closer than any content-width container.
   */
  isInContentWidthContainer: boolean
  /**
   * True inside a definite-height `st.grid` cell (pixel `row_height`). A
   * `grid.cell()` block fills that cell so `height="stretch"` descendants
   * resolve. Nested providers do not inherit this.
   */
  fillAvailableHeight?: boolean
  /**
   * `vertical_alignment` for that filling `grid.cell()` block, so
   * content-sized children still pack to the top, center, or bottom.
   */
  fillJustify?: { fallback: CSSProperties["justifyContent"]; safe?: string }
  /**
   * Set by a filling `grid.cell()` block for its own children. Stretch-height
   * elements take leftover space in the cell instead of 100% of the whole
   * cell (which overflows siblings). Nested providers do not inherit this.
   */
  verticalStretchGrows?: boolean
}

export const FlexContext = createContext<IFlexContext | null>(null)
FlexContext.displayName = "FlexContext"

/**
 * FlexContextProvider sets the current `FlexContext` value to one of the
 * following values given:
 *
 * - `null` -> Used when the parent is a standard `st.container` without any
 *   `direction` arg given to it.
 * - `row` -> Used when the parent is a `st.container` with
 *   `direction="horizontal"`.
 * - `column` -> Used when the parent is a `st.container` with
 *   `direction="vertical"`.
 *
 * Since Contexts work recursively, this means that any child component that
 * uses `FlexContext` will get the correct value for the `direction` prop of the
 * nearest `st.container` ancestor.
 *
 * @returns direction: The direction of the nearest `st.container` ancestor.
 * @returns isInHorizontalLayout: Whether the nearest `st.container` ancestor is
 *   a horizontal layout.
 * @returns isDirectlyInColumn: Whether widgets in this context are direct
 *   layout children of an `st.columns` column or an `st.grid` cell.
 * @returns parentWidth: The width of the parent container in pixels, if it has
 *   a fixed pixel width.
 * @returns isInContentWidthContainer: Whether this element is inside a content-width
 *   container, unless a closer fixed-width container overrides it.
 *
 * Search the codebase for `<FlexContextProvider` to see where this is used.
 *
 */
export const FlexContextProvider: FC<
  PropsWithChildren<{
    direction: Direction
    isRoot?: boolean
    isDirectlyInColumn?: boolean
    wrap?: boolean
    parentWidth?: number
    hasContentWidth?: boolean
    hasFixedWidth?: boolean
    fillAvailableHeight?: boolean
    fillJustify?: IFlexContext["fillJustify"]
    verticalStretchGrows?: boolean
    parentContext?: IFlexContext | null
  }>
> = ({
  children,
  direction,
  isRoot,
  isDirectlyInColumn = false,
  wrap = true,
  parentWidth,
  hasContentWidth = false,
  hasFixedWidth = false,
  fillAvailableHeight = false,
  fillJustify,
  verticalStretchGrows = false,
  parentContext = null,
}) => {
  const value = useMemo<IFlexContext>(() => {
    const isInHorizontalLayout = direction === Direction.HORIZONTAL

    // Determine if we're in a content-width container:
    // - If this container has content width -> true
    // - If this container has fixed width -> false (overrides parent)
    // - Otherwise -> inherit from parent
    let isInContentWidthContainer: boolean
    if (hasContentWidth) {
      isInContentWidthContainer = true
    } else if (hasFixedWidth) {
      isInContentWidthContainer = false
    } else {
      isInContentWidthContainer =
        parentContext?.isInContentWidthContainer ?? false
    }

    return {
      direction,
      isInHorizontalLayout,
      isDirectlyInColumn,
      isInRoot: isRoot ?? false,
      wrap,
      parentWidth,
      isInContentWidthContainer,
      ...(fillAvailableHeight && { fillAvailableHeight: true }),
      ...(fillJustify && { fillJustify }),
      ...(verticalStretchGrows && { verticalStretchGrows: true }),
    }
  }, [
    direction,
    isRoot,
    isDirectlyInColumn,
    wrap,
    parentWidth,
    hasContentWidth,
    hasFixedWidth,
    fillAvailableHeight,
    fillJustify,
    verticalStretchGrows,
    parentContext,
  ])

  return <FlexContext.Provider value={value}>{children}</FlexContext.Provider>
}
