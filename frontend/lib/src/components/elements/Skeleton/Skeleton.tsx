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

import { SquareSkeleton } from "./styled-components"

interface SkeletonProps {
  /**
   * Whether the wrapping container defines an explicit height (a pixel height
   * or "stretch") that the skeleton should fill. When false (the user passed
   * `height=None`), the skeleton falls back to the default element height
   * (`theme.sizes.minElementHeight`) instead of collapsing inside an
   * auto-height container.
   */
  fillContainerHeight?: boolean
}

/**
 * User-facing skeleton element for st.skeleton().
 *
 * When the container is sized via the layout config (explicit pixel or stretch
 * height), the skeleton fills it (100% height). Otherwise it uses the default
 * element height. The width always stretches to fill the container, which is
 * sized via the layout config.
 *
 * The skeleton is a decorative loading placeholder, so it is marked
 * `aria-hidden` to avoid noisy or empty announcements by assistive
 * technologies. Apps that need an audible "loading" cue should own that
 * announcement via a higher-level labeled live region.
 *
 * Uses the public "stSkeleton" CSS class (matching the `st<Element>` naming
 * convention so apps can target it) but a distinct "stSkeletonElement" test ID.
 * The separate test ID keeps this persistent user element from being tracked by
 * the app-loaded gate, which waits on the internal loading skeletons (Suspense
 * fallbacks) that use the "stSkeleton" test ID.
 */
const RawSkeleton: FC<SkeletonProps> = ({ fillContainerHeight = false }) => (
  <SquareSkeleton
    className="stSkeleton"
    data-testid="stSkeletonElement"
    height={fillContainerHeight ? "100%" : undefined}
    width="100%"
    aria-hidden="true"
  />
)

export const Skeleton = memo(RawSkeleton)
