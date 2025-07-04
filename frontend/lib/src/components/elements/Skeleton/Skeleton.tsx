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

import React, { FC, memo } from "react"

import { Skeleton as SkeletonProto } from "@streamlit/protobuf"

import { SquareSkeleton } from "./styled-components"

import { AppSkeleton } from "."

const RawSkeleton: FC<React.PropsWithChildren<{ element: SkeletonProto }>> = ({
  element,
}) => {
  if (element.style == SkeletonProto.SkeletonStyle.APP) {
    return <AppSkeleton /> // internal-only, does not use any of the element properties
  }

  return (
    <SquareSkeleton
      className="stSkeleton"
      data-testid="stSkeleton"
      height={element?.height ? element.height + "px" : undefined}
    />
  )
}

export const Skeleton = memo(RawSkeleton)
