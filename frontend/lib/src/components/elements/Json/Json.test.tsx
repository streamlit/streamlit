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

import { Json as JsonProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import * as getColors from "~lib/theme/getColors"

import Json, { JsonProps } from "./Json"

const getProps = (elementProps: Partial<JsonProto> = {}): JsonProps => ({
  element: JsonProto.create({
    body:
      '{ "proper": [1,2,3],' +
      '  "nested": { "thing1": "cat", "thing2": "hat" },' +
      '  "json": "structure" }',
    ...elementProps,
  }),
})

describe("JSON element", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders json as expected", () => {
    const props = getProps()
    render(<Json {...props} />)
    const jsonElement = screen.getByTestId("stJson")
    expect(jsonElement).toBeInTheDocument()
    expect(jsonElement).toHaveClass("stJson")
  })

  it("should show an error with invalid JSON", () => {
    const props = getProps({ body: "invalid JSON" })
    render(<Json {...props} />)
    expect(screen.getByTestId("stAlertContainer")).toBeInTheDocument()
  })

  it("renders json with NaN and infinity values", () => {
    const props = getProps({
      body: `{
      "numbers":[ -1e27, NaN, Infinity, -Infinity, 2.2822022,-2.2702775],
    }`,
    })
    render(<Json {...props} />)
    expect(screen.getByTestId("stJson")).toBeInTheDocument()
  })

  describe("getJsonTheme", () => {
    it("picks a reasonable theme when the background is light", () => {
      // <Json> uses `hasLightBackgroundColor` to test whether our theme
      // is "light" or "dark". Mock the return value for the test.
      vi.spyOn(getColors, "hasLightBackgroundColor").mockReturnValue(true)

      render(<Json {...getProps()} />)
      // checks resulting json coloration based on theme passed
      expect(screen.getByText("}")).toHaveStyle("color: rgb(0, 43, 54)")
    })

    it("picks a reasonable theme when the background is dark", () => {
      // <Json> uses `hasLightBackgroundColor` to test whether our theme
      // is "light" or "dark". Mock the return value for the test.
      vi.spyOn(getColors, "hasLightBackgroundColor").mockReturnValue(false)
      render(<Json {...getProps()} />)
      expect(screen.getByText("}")).toHaveStyle("color: rgb(249, 248, 245)")
    })
  })
})
