/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React, { FC, PropsWithChildren, useContext } from "react"

import { useWindowDimensions } from "@streamlit/lib/src/components/shared/WindowDimensions/useWindowDimensions"
import { WindowDimensionsContext } from "@streamlit/lib/src/components/shared/WindowDimensions"

/**
 * Registers the current window dimensions in the context. A runtime error will
 * be thrown if used multiple times. Since it listens to window resize events,
 * any additional instances would cause unnecessary performance overhead.
 */
export const WindowDimensionsProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const dimensions = useWindowDimensions()

  const existingDimensions = useContext(WindowDimensionsContext)

  if (existingDimensions) {
    throw new Error(
      "WindowDimensionsProvider should only be used once per app. If you need to read window dimensions, utilize `useRequiredContext(WindowDimensionsContext)` instead."
    )
  }

  return (
    <WindowDimensionsContext.Provider value={dimensions}>
      {children}
    </WindowDimensionsContext.Provider>
  )
}
