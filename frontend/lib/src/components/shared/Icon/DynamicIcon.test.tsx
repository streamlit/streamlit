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

import {
  DynamicIcon,
  DynamicIconProps,
  getFilledStarIconSrc,
} from "./DynamicIcon"

const getProps = (
  props: Partial<DynamicIconProps> = {}
): DynamicIconProps => ({
  iconValue: ":material/flag:",
  ...props,
})

describe("Dynamic icon", () => {
  it("renders without crashing with Material icon", () => {
    const props = getProps({ iconValue: ":material/add_circle:" })
    render(<DynamicIcon {...props} />)
    const testId = screen.getByTestId("stIconMaterial")
    const icon = screen.getByText("add_circle")

    expect(testId).toBeInTheDocument()
    expect(icon).toBeInTheDocument()
    expect(testId.textContent).toEqual(icon.textContent)
  })

  it("renders without crashing with Emoji icon", () => {
    const props = getProps({ iconValue: "⛰️" })
    render(<DynamicIcon {...props} />)
    const testId = screen.getByTestId("stIconEmoji")
    const icon = screen.getByText("⛰️")

    expect(testId).toBeInTheDocument()
    expect(icon).toBeInTheDocument()
    expect(testId.textContent).toEqual(icon.textContent)
  })

  it("renders without crashing Styled image", () => {
    const props = getProps({ iconValue: ":material/star_filled:" })
    render(<DynamicIcon {...props} />)
    const testId = screen.getByTestId("stImageIcon")
    const srcAttr = testId.getAttribute("src")

    expect(testId).toBeInTheDocument()
    expect(srcAttr).toEqual(getFilledStarIconSrc())
  })
})
