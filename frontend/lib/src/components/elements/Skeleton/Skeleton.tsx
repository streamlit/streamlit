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

import { FC, memo } from "react"

import { Skeleton as SkeletonProto } from "@streamlit/protobuf"

import { AppSkeleton } from "./AppSkeleton"
import { SquareSkeleton } from "./styled-components"

interface SkeletonProps {
  element: SkeletonProto
  /**
   * When true, the skeleton fills its container (100% width and height).
   * This is used by the public st.skeleton() API path where the parent
   * ElementContainer is sized via layout config.
   *
   * When false/undefined (default), the skeleton uses its default fallback
   * dimensions. This is used for internal skeleton usages like:
   * - ComponentInstance loading skeletons (custom components)
   * - Suspense fallbacks
   * - StreamlitMarkdown plugin loading
   *
   * This separation ensures the public API respects layout config sizing while
   * internal usages maintain backward-compatible default heights that don't
   * collapse to 0 in height: auto containers.
   */
  fillContainer?: boolean
}

const RawSkeleton: FC<SkeletonProps> = ({ element, fillContainer }) => {
  if (element.style == SkeletonProto.SkeletonStyle.APP) {
    return <AppSkeleton /> // internal-only, does not use any of the element properties
  }

  // When fillContainer is true (public st.skeleton() path), the skeleton fills
  // its container because the parent ElementContainer is sized via layout config.
  // When false/undefined (internal usage), use default dimensions so the skeleton
  // doesn't collapse to 0 in height: auto containers.
  return (
    <SquareSkeleton
      className="stSkeleton"
      data-testid="stSkeleton"
      height={fillContainer ? "100%" : undefined}
      width={fillContainer ? "100%" : undefined}
    />
  )
}

export const Skeleton = memo(RawSkeleton)
