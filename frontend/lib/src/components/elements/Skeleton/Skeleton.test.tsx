/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React from "react"
import { render } from "@streamlit/lib/src/test_util"
import { screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import { Skeleton } from "./Skeleton"

describe("Skeleton element", () => {
  it("renders without delay", () => {
    render(<Skeleton />)

    // Render the skeleton immediately, without any sort of delay.
    // (This is normal React behavior, but different from AppSkeleton, so I'm
    // writing a very trivial test for it.)
    expect(screen.getByTestId("stSkeleton")).toBeVisible()
  })

  it("renders with height property", () => {
    const height = "100px"
    render(<Skeleton height={height} />)

    const style = getComputedStyle(screen.getByTestId("stSkeleton"))
    expect(style.height).toBe(height)
  })
})
