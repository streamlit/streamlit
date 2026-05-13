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
import { notNullOrUndefined } from "@streamlit/utils"

import { AppSkeleton } from "./AppSkeleton"
import { SquareSkeleton } from "./styled-components"

const RawSkeleton: FC<React.PropsWithChildren<{ element: SkeletonProto }>> = ({
  element,
}) => {
  if (element.style == SkeletonProto.SkeletonStyle.APP) {
    return <AppSkeleton /> // internal-only, does not use any of the element properties
  }

  // When the skeleton has an explicit height specified (via layout config from st.skeleton()),
  // it fills its container (100% width and height). When no height is specified
  // (Suspense fallback, internal usage like custom components), we don't pass height/width
  // so that SquareSkeleton uses its default fallback values. This avoids height: 100%
  // collapsing to 0 inside a height: auto container.
  // Note: element.height is null when not set (proto3 optional), and 0 is a valid explicit value.
  const useContainerSize =
    notNullOrUndefined(element.height) && element.height > 0
  return (
    <SquareSkeleton
      className="stSkeleton"
      data-testid="stSkeleton"
      height={useContainerSize ? "100%" : undefined}
      width={useContainerSize ? "100%" : undefined}
    />
  )
}

export const Skeleton = memo(RawSkeleton)
