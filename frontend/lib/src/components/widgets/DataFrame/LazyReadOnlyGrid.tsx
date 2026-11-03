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

import { lazy, type ReactElement, Suspense } from "react"

import { SquareSkeleton } from "~lib/components/elements/Skeleton/styled-components"
import ErrorBoundary from "~lib/components/shared/ErrorBoundary/ErrorBoundary"

import type { ReadOnlyGridProps } from "./ReadOnlyGrid"

const ReadOnlyGrid = lazy(() =>
  import("./ReadOnlyGrid").then(module => ({
    default: module.ReadOnlyGrid,
  }))
)

/**
 * `ReadOnlyGrid` that downloads its DataFrame chunk on first render, so pages
 * with charts only load that chunk once a user opens a "Show data" view.
 *
 * Until the chunk arrives, a skeleton with the grid's height holds its space.
 * The local `Suspense` and `ErrorBoundary` keep a pending or failed load in
 * the data-view slot. Without them, `ElementContainer`'s boundaries replace
 * the whole chart; in fullscreen that unmounts the wrapper and leaves the
 * page scroll-locked.
 */
export function LazyReadOnlyGrid(props: ReadOnlyGridProps): ReactElement {
  const { height } = props
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <SquareSkeleton
            data-testid="stSkeleton"
            aria-hidden="true"
            height={height ? `${height}px` : undefined}
          />
        }
      >
        <ReadOnlyGrid {...props} />
      </Suspense>
    </ErrorBoundary>
  )
}
