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
  type DynamicIconProps,
  extractLeadingMaterialIcon,
  getFilledStarIconSrc,
  getIconAccessibleName,
  getMenuTriggerAccessibleName,
  isMaterialIcon,
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
    // Decorative by default; controls must supply their own accessible name.
    expect(testId).toHaveAttribute("aria-hidden", "true")
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
    expect(testId).toHaveAttribute("alt", "")
  })

  it("uses 1em when size is inherit", () => {
    render(<DynamicIcon iconValue=":material/flag:" size="inherit" />)

    expect(screen.getByTestId("stIconMaterial")).toHaveStyle({
      fontSize: "1em",
      width: "1em",
      height: "1em",
    })
  })

  it("inherits color when the material icon color is blank", () => {
    render(<DynamicIcon iconValue=":material/flag:" color="" />)

    expect(screen.getByTestId("stIconMaterial")).toHaveStyle({
      color: "inherit",
    })
  })

  it("sizes the spinner from 1em when size is inherit", () => {
    render(<DynamicIcon iconValue="spinner" size="inherit" />)

    expect(screen.getByTestId("stSpinnerIcon")).toHaveStyle({
      width: "calc(1em * 0.80)",
      height: "calc(1em * 0.80)",
    })
  })

  it("scales inherit emoji via font-size without compounding the box", () => {
    render(<DynamicIcon iconValue="🔥" size="inherit" />)

    expect(screen.getByTestId("stIconEmoji")).toHaveStyle({
      fontSize: "calc(1em * 0.90)",
      width: "1em",
      height: "1em",
    })
  })
})

describe("getIconAccessibleName", () => {
  it.each([
    [":material/thumb_up:", "thumb_up icon"],
    [":material/add_circle:", "add_circle icon"],
    ["spinner", "Loading"],
    ["😀", "😀"],
    ["emoji:⛰️", "⛰️"],
  ])("getIconAccessibleName(%s) returns %s", (input, expected) => {
    expect(getIconAccessibleName(input)).toBe(expected)
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

describe("getMenuTriggerAccessibleName", () => {
  it.each([
    // Menu-style icons without separate icon prop return their name
    [undefined, ":material/menu:", "Menu"],
    [undefined, ":material/more_vert:", "More options"],
    [undefined, ":material/more_horiz:", "More options"],
    [undefined, " :material/menu: ", "Menu"],

    // Menu-style icon prop with an empty label returns its name
    [":material/menu:", "", "Menu"],
    [":material/more_vert:", "", "More options"],
    [":material/more_horiz:", undefined, "More options"],
    [":material/more_vert:", "  ", "More options"],

    // A separate icon plus non-empty label text is not icon-only
    [":material/edit:", ":material/menu:", undefined],
    ["some-icon", ":material/more_vert:", undefined],
    [":material/more_vert:", "Actions", undefined],
    [":material/menu:", ":material/menu:", undefined],

    // Non-menu-style icon prop with an empty label returns undefined
    [":material/edit:", "", undefined],
    ["spinner", "", undefined],

    // Non-menu-style icons return undefined
    [undefined, ":material/edit:", undefined],
    [undefined, ":material/settings:", undefined],

    // Labels with text (not icon-only) return undefined
    [undefined, ":material/menu: Menu", undefined],
    [undefined, "Menu", undefined],

    // Edge cases
    [undefined, undefined, undefined],
    [undefined, "", undefined],
    ["", ":material/menu:", "Menu"],
  ])(
    "getMenuTriggerAccessibleName(%s, %s) returns %s",
    (icon, label, expected) => {
      expect(getMenuTriggerAccessibleName(icon, label)).toBe(expected)
    }
  )
})
