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

import React from "react"

import { BaseProvider, LightTheme } from "baseui"
import { screen } from "@testing-library/react"

import { render } from "~lib/test_util"

import Modal, { calculateModalSize } from "./Modal"

describe("Modal component", () => {
  it("renders without crashing", () => {
    render(
      <BaseProvider theme={LightTheme}>
        <Modal isOpen />
      </BaseProvider>
    )

    const modalElement = screen.getByTestId("stDialog")
    expect(modalElement).toBeInTheDocument()
    expect(modalElement).toHaveClass("stDialog")
  })
})
describe("calculateModalSize", () => {
  it("returns the default size when no size is provided", () => {
    const size = calculateModalSize(undefined)
    expect(size).toBe("default")
  })
  it("returns the auto size when passed size is 'auto'", () => {
    const size = calculateModalSize("auto")
    expect(size).toBe("auto")
  })
  it("calculated the size based on the spacaing and content width when size is 'full'", () => {
    const size = calculateModalSize("full", "100px", "100px")
    expect(size).toBe("calc(100px + 100px)")
  })
})
