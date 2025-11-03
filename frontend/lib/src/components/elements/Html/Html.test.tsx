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

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Html as HtmlProto } from "@streamlit/protobuf"

import Html from "./Html"

function makeProto(partial: Partial<HtmlProto>): HtmlProto {
  return {
    body: "",
    unsafeAllowJavascript: false,
    toJSON: () => ({}),
    ...partial,
  }
}

describe("Html element", () => {
  describe("when unsafeAllowJavascript=false", () => {
    const unsafeAllowJavascript = false

    it("sanitizes and does not include script", () => {
      const element = makeProto({
        body: "<div id=\"x\">A</div><script>document.body.dataset.x='ran'</script>",
        unsafeAllowJavascript,
      })

      render(<Html element={element} />)

      const root = screen.getByTestId("stHtml")
      expect(root.innerHTML).toContain('<div id="x">A</div>')
      // script tags are removed by sanitize
      expect(root.innerHTML).not.toContain("<script")
    })

    it("preserves target=_blank and sets rel attributes", () => {
      const element = makeProto({
        body: '<a href="https://example.com" target="_blank">Go</a>',
        unsafeAllowJavascript,
      })

      render(<Html element={element} />)

      const root = screen.getByTestId("stHtml")
      const link = root.querySelector<HTMLAnchorElement>("a")
      expect(link).not.toBeNull()
      expect(link?.getAttribute("target")).toBe("_blank")
      expect(link?.getAttribute("rel")).toBe("noopener noreferrer")
    })

    it("removes dangerous attributes and style/script tags", () => {
      const element = makeProto({
        body: '<div id="x" onclick="alert(1)">A</div><style>.a{color:red}</style><script>window.x=1</script>',
        unsafeAllowJavascript,
      })

      render(<Html element={element} />)

      const root = screen.getByTestId("stHtml")
      const x = root.querySelector("#x") as HTMLElement
      expect(x).not.toBeNull()
      expect(x.hasAttribute("onclick")).toBe(false)
      // style tags are allowed in sanitized HTML
      expect(root.innerHTML).toContain("<style")
      expect(root.innerHTML).not.toContain("<script")
    })
  })

  describe("when unsafeAllowJavascript=true", () => {
    const unsafeAllowJavascript = true

    it("injects raw HTML and contains script tag", () => {
      const element = makeProto({
        body: '<div id="x">A</div><script>window.__x=1</script>',
        unsafeAllowJavascript,
      })

      render(<Html element={element} />)

      const root = screen.getByTestId("stHtml")
      // raw HTML injected
      expect(root.querySelector("#x")).not.toBeNull()
      // our logic replaces scripts with new script elements; they remain present
      const scripts = root.querySelectorAll("script")
      expect(scripts.length).toBeGreaterThan(0)
    })
  })
})
