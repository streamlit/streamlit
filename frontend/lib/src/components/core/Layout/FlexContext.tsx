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

import React, { createContext, FC, PropsWithChildren, useMemo } from "react"

import { Direction } from "./utils"

export interface IFlexContext {
  direction: Direction | undefined
  isInHorizontalLayout: boolean
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
 *
 * Search the codebase for `<FlexContextProvider` to see where this is used.
 *
 */
export const FlexContextProvider: FC<
  PropsWithChildren<{ direction: Direction }>
> = ({ children, direction }) => {
  const value = useMemo<IFlexContext>(() => {
    const isInHorizontalLayout = direction === Direction.HORIZONTAL
    return {
      direction,
      isInHorizontalLayout,
    }
  }, [direction])

  return <FlexContext.Provider value={value}>{children}</FlexContext.Provider>
}
