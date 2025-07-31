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

import { screen } from "@testing-library/react"
import { BaseProvider, LightTheme } from "baseui"

import { render } from "@streamlit/lib"

import UnsupportedBrowserDialog from "./UnsupportedBrowserDialog"

describe("UnsupportedBrowserDialog", () => {
  it("renders without crashing", () => {
    render(
      <BaseProvider theme={LightTheme}>
        <UnsupportedBrowserDialog onClose={() => {}} />
      </BaseProvider>
    )

    expect(screen.getByTestId("stDialog")).toBeInTheDocument()
    expect(
      screen.getByTestId("stUnsupportedBrowserDialog")
    ).toBeInTheDocument()
  })

  it("should render a header", () => {
    const onClose = vi.fn()
    render(
      <BaseProvider theme={LightTheme}>
        <UnsupportedBrowserDialog onClose={onClose} />
      </BaseProvider>
    )

    expect(
      screen.getByTestId("stUnsupportedBrowserDialog")
    ).toBeInTheDocument()
    expect(screen.getByText("Record a screencast")).toBeInTheDocument()
  })

  it("should render a body with the correct message", () => {
    render(
      <BaseProvider theme={LightTheme}>
        <UnsupportedBrowserDialog onClose={() => {}} />
      </BaseProvider>
    )
    expect(
      screen.getByTestId("stUnsupportedBrowserDialog")
    ).toBeInTheDocument()
    expect(screen.getByText("👾")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Due to limitations with some browsers, this feature is only supported on recent desktop versions of Chrome, Firefox, and Edge."
      )
    ).toBeInTheDocument()
  })
})
