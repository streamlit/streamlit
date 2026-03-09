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

import { createElement, Fragment } from "react"

import {
  hasRenderableNode,
  hasVisibleHeaderContent,
  HeaderContentInputs,
} from "./headerUtils"

const NO_CONTENT: HeaderContentInputs = {
  hasLogo: false,
  hasExpandButton: false,
  hasNavigation: false,
  showToolbar: false,
  hasRightContent: false,
}

describe("hasVisibleHeaderContent", () => {
  it("returns false when no content is present", () => {
    expect(hasVisibleHeaderContent(NO_CONTENT)).toBe(false)
  })

  it.each([
    { field: "hasLogo" as const },
    { field: "hasExpandButton" as const },
    { field: "hasNavigation" as const },
  ])("returns true when $field is true", ({ field }) => {
    expect(hasVisibleHeaderContent({ ...NO_CONTENT, [field]: true })).toBe(
      true
    )
  })

  it("returns true when showToolbar AND hasRightContent are both true", () => {
    expect(
      hasVisibleHeaderContent({
        ...NO_CONTENT,
        showToolbar: true,
        hasRightContent: true,
      })
    ).toBe(true)
  })

  it("returns false when showToolbar is true but hasRightContent is false", () => {
    expect(
      hasVisibleHeaderContent({
        ...NO_CONTENT,
        showToolbar: true,
        hasRightContent: false,
      })
    ).toBe(false)
  })

  it("returns false when hasRightContent is true but showToolbar is false", () => {
    expect(
      hasVisibleHeaderContent({
        ...NO_CONTENT,
        showToolbar: false,
        hasRightContent: true,
      })
    ).toBe(false)
  })
})

describe("hasRenderableNode", () => {
  it("returns false for an empty fragment", () => {
    expect(hasRenderableNode(createElement(Fragment))).toBe(false)
  })

  it("returns false for a fragment with only empty children", () => {
    expect(
      hasRenderableNode(createElement(Fragment, null, null, false, undefined))
    ).toBe(false)
  })

  it("returns true for a fragment with renderable children", () => {
    expect(
      hasRenderableNode(
        createElement(
          Fragment,
          null,
          false,
          createElement("div", null, "Toolbar")
        )
      )
    ).toBe(true)
  })
})
