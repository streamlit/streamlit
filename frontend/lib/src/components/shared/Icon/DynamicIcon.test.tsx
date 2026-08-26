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

import {
  DynamicIcon,
  DynamicIconProps,
  extractLeadingMaterialIcon,
  getFilledStarIconSrc,
  isMaterialIcon,
  isMenuStyleIconLabel,
} from "./DynamicIcon"

const getProps = (
  props: Partial<DynamicIconProps> = {}
): DynamicIconProps => ({
  iconValue: ":material/flag:",
  ...props,
})

describe("Dynamic icon", () => {
  it("renders spinner with aria-hidden", () => {
    render(<DynamicIcon iconValue="spinner" />)
    const spinnerIcon = screen.getByTestId("stSpinnerIcon")
    expect(spinnerIcon).toHaveAttribute("aria-hidden", "true")
  })

  it("renders without crashing with Material icon", () => {
    const props = getProps({ iconValue: ":material/add_circle:" })
    render(<DynamicIcon {...props} />)
    const testId = screen.getByTestId("stIconMaterial")
    const icon = screen.getByText("add_circle")

    expect(testId).toBeInTheDocument()
    expect(icon).toBeInTheDocument()
    expect(testId.textContent).toEqual(icon.textContent)
    // Should have translate="no" to prevent the icon text from being translated:
    expect(testId).toHaveAttribute("translate", "no")
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

  it("renders without crashing with prefixed Emoji icon", () => {
    const props = getProps({ iconValue: "emoji:⛰️" })
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

describe("isMaterialIcon", () => {
  it.each([
    [":material/edit:", true],
    [":material/delete:", true],
    [":material/settings_suggest:", true],
    [":material/:", false],
    ["material/edit", false],
    [":emoji/smile:", false],
    ["plain text", false],
    ["", false],
  ])("isMaterialIcon(%s) returns %s", (input, expected) => {
    expect(isMaterialIcon(input)).toBe(expected)
  })
})

describe("extractLeadingMaterialIcon", () => {
  it.each([
    [":material/edit: Edit item", ":material/edit:", "Edit item"],
    [":material/delete:", ":material/delete:", ""],
    [":material/settings:   Settings", ":material/settings:", "Settings"],
    [
      ":material/settings_suggest: Advanced",
      ":material/settings_suggest:",
      "Advanced",
    ],
    ["No icon here", null, "No icon here"],
    ["Item :material/edit:", null, "Item :material/edit:"],
    ["🗑️ Delete", null, "🗑️ Delete"],
    ["", null, ""],
  ])(
    'extractLeadingMaterialIcon("%s") returns icon=%s, text="%s"',
    (input, expectedIcon, expectedText) => {
      const result = extractLeadingMaterialIcon(input)
      expect(result.icon).toBe(expectedIcon)
      expect(result.text).toBe(expectedText)
    }
  )
})

describe("isMenuStyleIconLabel", () => {
  it.each([
    // Menu-style icons without separate icon prop should return true
    [undefined, ":material/menu:", true],
    [undefined, ":material/more_vert:", true],
    [undefined, ":material/more_horiz:", true],
    [undefined, " :material/menu: ", true],

    // When icon prop is set, should return false (not icon-only)
    [":material/edit:", ":material/menu:", false],
    ["some-icon", ":material/more_vert:", false],

    // Non-menu-style icons should return false
    [undefined, ":material/edit:", false],
    [undefined, ":material/settings:", false],

    // Labels with text (not icon-only) should return false
    [undefined, ":material/menu: Menu", false],
    [undefined, "Menu", false],

    // Edge cases
    [undefined, undefined, false],
    [undefined, "", false],
    ["", ":material/menu:", true],
  ])("isMenuStyleIconLabel(%s, %s) returns %s", (icon, label, expected) => {
    expect(isMenuStyleIconLabel(icon, label)).toBe(expected)
  })
})
