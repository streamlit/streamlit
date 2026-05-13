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

    // Render the skeleton immediately, without any sort of delay.
    // (This is normal React behavior, but different from AppSkeleton, so I'm
    // writing a very trivial test for it.)
    const skeletonElement = screen.getByTestId("stSkeleton")
    expect(skeletonElement).toBeVisible()
    expect(skeletonElement).toHaveClass("stSkeleton")
  })

  it("fills container when fillContainer is true (public st.skeleton path)", () => {
    const props = SkeletonProto.create({ height: 100 })
    render(<Skeleton element={props} fillContainer />)

    const testSkeleton = screen.getByTestId("stSkeleton")
    // When fillContainer is true, dimensions fill the container
    expect(testSkeleton).toHaveAttribute("height", "100%")
    expect(testSkeleton).toHaveAttribute("width", "100%")
  })

  it("uses default dimensions when fillContainer is false (internal usage)", () => {
    // This covers ComponentInstance, Suspense fallback, StreamlitMarkdown paths
    const props = SkeletonProto.create({ height: 100 })
    render(<Skeleton element={props} fillContainer={false} />)

    const testSkeleton = screen.getByTestId("stSkeleton")
    // Should NOT have explicit height/width attributes - uses styled-component defaults
    expect(testSkeleton).not.toHaveAttribute("height")
    expect(testSkeleton).not.toHaveAttribute("width")
  })

  it("uses default dimensions when fillContainer is not set (internal usage)", () => {
    // This covers ComponentInstance, Suspense fallback, StreamlitMarkdown paths
    const props = SkeletonProto.create()
    render(<Skeleton element={props} />)

    const testSkeleton = screen.getByTestId("stSkeleton")
    // Should NOT have explicit height/width attributes - uses styled-component defaults
    expect(testSkeleton).not.toHaveAttribute("height")
    expect(testSkeleton).not.toHaveAttribute("width")
  })

  it("uses default dimensions when element.height is 0 and fillContainer is false", () => {
    // height: 0 is a valid explicit value but should still use defaults
    // when not in the public st.skeleton() path
    const props = SkeletonProto.create({ height: 0 })
    render(<Skeleton element={props} fillContainer={false} />)

    const testSkeleton = screen.getByTestId("stSkeleton")
    expect(testSkeleton).not.toHaveAttribute("height")
    expect(testSkeleton).not.toHaveAttribute("width")
  })

  it("renders app skeleton", async () => {
    const props = SkeletonProto.create({
      style: SkeletonProto.SkeletonStyle.APP,
    })
    render(<Skeleton element={props} />)

    // Await the skeleton to appear.
    expect(await screen.findByTestId("stAppSkeleton")).toBeVisible()
  })
})
