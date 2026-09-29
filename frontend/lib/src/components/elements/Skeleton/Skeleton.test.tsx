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

import { render } from "~lib/test_util"

import { Skeleton } from "./Skeleton"

describe("Skeleton element", () => {
  it("uses the default element height when no container height is set", () => {
    render(<Skeleton />)

    const skeletonElement = screen.getByTestId("stSkeletonElement")
    expect(skeletonElement).toBeVisible()
    expect(skeletonElement).toHaveClass("stSkeleton")
    // Falls back to the standard element height (theme.sizes.minElementHeight)
    // rather than collapsing inside an auto-height container.
    expect(skeletonElement).toHaveStyle({ height: "2.5rem", width: "100%" })
  })

  it("fills the container height when an explicit height is provided", () => {
    render(<Skeleton fillContainerHeight={true} />)

    const skeletonElement = screen.getByTestId("stSkeletonElement")
    expect(skeletonElement).toHaveStyle({ height: "100%", width: "100%" })
  })

  it("is hidden from assistive technologies (decorative placeholder)", () => {
    render(<Skeleton />)

    const skeletonElement = screen.getByTestId("stSkeletonElement")
    expect(skeletonElement).toHaveAttribute("aria-hidden", "true")
    // It must not be announced as a live status region.
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})
