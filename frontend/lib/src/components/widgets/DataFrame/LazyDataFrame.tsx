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

import { type ComponentProps, lazy, type ReactElement, Suspense } from "react"

import { SquareSkeleton } from "~lib/components/elements/Skeleton/styled-components"

const DataFrame = lazy(() => import("./DataFrame"))

/**
 * `DataFrame` (used by `st.dataframe` and `st.data_editor`) that downloads its
 * code chunk on first render.
 *
 * Until the chunk arrives, a skeleton with the configured pixel height holds
 * the table's space, so content below doesn't shift once it loads. The
 * element container can't reserve that space: for pixel heights it takes its
 * height from the grid so users can drag-resize the table.
 */
export function LazyDataFrame(
  props: ComponentProps<typeof DataFrame>
): ReactElement {
  const pixelHeight = props.heightConfig?.pixelHeight
  return (
    <Suspense
      fallback={
        <SquareSkeleton
          data-testid="stSkeleton"
          aria-hidden="true"
          height={pixelHeight ? `${pixelHeight}px` : undefined}
        />
      }
    >
      <DataFrame {...props} />
    </Suspense>
  )
}
