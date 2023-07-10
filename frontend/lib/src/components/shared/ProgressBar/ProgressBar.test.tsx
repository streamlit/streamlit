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
import { screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { render } from "@streamlit/lib/src/test_util"

import ProgressBar from "./ProgressBar"

describe("ProgressBar component", () => {
  it("renders without crashing", () => {
    render(<ProgressBar value={50} width={100} />)

    const progressBarElement = screen.getByRole("progressbar")
    expect(progressBarElement).toBeInTheDocument()
  })

  it("sets the value correctly", () => {
    render(<ProgressBar value={75} width={100} />)
    const progressBarElement = screen.getByRole("progressbar")
    expect(progressBarElement).toHaveAttribute("aria-valuenow", "75")
  })
})
