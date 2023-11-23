/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import { AppSkeleton } from "./AppSkeleton"

describe("AppSkeleton element", () => {
  it("renders after a delay", async () => {
    render(<AppSkeleton />)

    // At first, the skeleton should not appear on screen.
    expect(screen.queryAllByTestId("stAppSkeleton")).toEqual([])

    // Then, a few ms later (500ms at time of writing) we show the skeleton.
    expect(await screen.findByTestId("stAppSkeleton")).toBeVisible()
  })
})
