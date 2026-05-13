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

import { screen } from "@testing-library/react"

import { Skeleton as SkeletonProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"

import { Skeleton } from "./Skeleton"

describe("Skeleton element", () => {
  it("renders without delay", () => {
    const props = SkeletonProto.create()
    render(<Skeleton element={props} />)

    const skeletonElement = screen.getByTestId("stSkeleton")
    expect(skeletonElement).toBeVisible()
    expect(skeletonElement).toHaveClass("stSkeleton")
  })

  it("fills container with 100% width and height", () => {
    const props = SkeletonProto.create()
    render(<Skeleton element={props} />)

    const testSkeleton = screen.getByTestId("stSkeleton")
    expect(testSkeleton).toHaveAttribute("height", "100%")
    expect(testSkeleton).toHaveAttribute("width", "100%")
  })
})
