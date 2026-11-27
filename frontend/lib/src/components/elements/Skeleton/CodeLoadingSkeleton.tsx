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

import type { ComponentProps, ReactElement } from "react"

import { useElementLoadState } from "~lib/hooks/useElementLoadState"

import { SquareSkeleton } from "./styled-components"

/**
 * Suspense fallback while an element's code-split bundle loads behind the
 * element's own Suspense boundary. The element container's boundary never
 * sees that load, so the skeleton keeps the element pending for render
 * timing.
 */
export function CodeLoadingSkeleton(
  props: ComponentProps<typeof SquareSkeleton>
): ReactElement {
  useElementLoadState("code", false)
  return (
    <SquareSkeleton data-testid="stSkeleton" aria-hidden="true" {...props} />
  )
}
