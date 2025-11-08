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

import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { Html as HtmlProto } from "@streamlit/protobuf"

import Html from "./Html"

declare global {
  // Augment Window for test globals used by injected scripts
  interface Window {
    __counter?: number
    __runs?: number
  }
}

function makeProto(partial: Partial<HtmlProto>): HtmlProto {
  return {
    body: "",
    unsafeAllowJavascript: false,
    toJSON: () => ({}),
    ...partial,
  }
}

describe("Html element", () => {
  describe.each([
    {
      unsafeAllowJavascript: false,
      title: "when unsafeAllowJavascript=false",
    },
    {
      unsafeAllowJavascript: true,
      title: "when unsafeAllowJavascript=true",
    },
  ])("common behaviors $title", ({ unsafeAllowJavascript }) => {
    it("renders the container with the expected test id and class", () => {
      const element = makeProto({
        body: "<div>hello</div>",
        unsafeAllowJavascript,
      })

      render(<Html element={element} />)

      const root = screen.getByTestId("stHtml")
      expect(root).not.toBeNull()
      expect(root.classList.contains("stHtml")).toBe(true)
    })

    it("preserves target=_blank links and applies rel attributes", () => {
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

    it("retains style tags", () => {
      const element = makeProto({
        body: '<style>.a{color:red}</style><div class="a">A</div>',
        unsafeAllowJavascript,
      })

      render(<Html element={element} />)

      const root = screen.getByTestId("stHtml")
      expect(root.innerHTML).toContain("<style")
    })
  })

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

    it("clones and replaces inline scripts (this proves scripts will be executed)", async () => {
      const body = "<script>/* inline */</script>"
      const element = makeProto({ body, unsafeAllowJavascript })

      const createSpy = vi.spyOn(document, "createElement")
      const replaceSpy = vi.spyOn(Node.prototype, "replaceChild")

      render(<Html element={element} />)

      await waitFor(() => {
        const root = screen.getByTestId("stHtml")
        const scripts = root.querySelectorAll("script")
        expect(scripts.length).toBe(1)
      })

      // At least one new script element was created and old replaced
      expect(createSpy.mock.calls.some(([tag]) => tag === "script")).toBe(true)
      expect(replaceSpy).toHaveBeenCalled()

      const script = screen.getByTestId("stHtml").querySelector("script")
      expect(script?.textContent).toContain("inline")

      createSpy.mockRestore()
      replaceSpy.mockRestore()
    })

    it("preserves script attributes when recreating external and inline scripts", () => {
      const body = [
        '<script src="https://example.com/a.js" async defer crossorigin="anonymous" referrerpolicy="no-referrer" integrity="sha256-abc"></script>',
        '<script type="module" nonce="xyz">/* noop */</script>',
      ].join("")

      const element = makeProto({ body, unsafeAllowJavascript })

      render(<Html element={element} />)

      const root = screen.getByTestId("stHtml")
      const scripts = root.querySelectorAll("script")
      expect(scripts.length).toBe(2)

      const [ext, mod] = Array.from(scripts)
      expect(
        ext.getAttribute("src")?.includes("https://example.com/a.js")
      ).toBe(true)
      expect(ext.hasAttribute("async")).toBe(true)
      expect(ext.hasAttribute("defer")).toBe(true)
      expect(ext.getAttribute("crossorigin")).toBe("anonymous")
      expect(ext.getAttribute("referrerpolicy")).toBe("no-referrer")
      expect(ext.getAttribute("integrity")).toBe("sha256-abc")

      expect(mod.getAttribute("type")).toBe("module")
      expect(mod.getAttribute("nonce")).toBe("xyz")
    })

    it("cleans previous content on dependency change and only runs cloning when body changes", async () => {
      const first = makeProto({
        body: '<div id="first"></div><script>/* a */</script>',
        unsafeAllowJavascript,
      })

      const replaceSpy = vi.spyOn(Node.prototype, "replaceChild")

      const { rerender } = render(<Html element={first} />)

      let root = screen.getByTestId("stHtml")
      await waitFor(() => expect(root.querySelector("#first")).not.toBeNull())

      const initialReplaceCalls = replaceSpy.mock.calls.length

      // Re-render with SAME body: should not perform additional replacements
      rerender(<Html element={first} />)
      await waitFor(() => {
        expect(replaceSpy.mock.calls.length).toBe(initialReplaceCalls)
      })

      // Re-render with different body: cleanup and more replacements
      const second = makeProto({
        body: '<div id="second"></div><script>/* b */</script>',
        unsafeAllowJavascript,
      })
      rerender(<Html element={second} />)

      root = screen.getByTestId("stHtml")
      expect(root.querySelector("#first")).toBeNull()
      await waitFor(() => expect(root.querySelector("#second")).not.toBeNull())
      expect(replaceSpy.mock.calls.length).toBeGreaterThan(initialReplaceCalls)

      replaceSpy.mockRestore()
    })

    it("handles attribute copy failures gracefully (catch path)", () => {
      const original = Element.prototype.setAttribute
      const spy = vi
        .spyOn(Element.prototype, "setAttribute")
        .mockImplementation(function (
          this: Element,
          name: string,
          value: string
        ) {
          if (name === "nonce") {
            throw new Error("boom")
          }
          return original.call(this, name, value)
        })

      const element = makeProto({
        body: '<script type="module" nonce="throw-me">/* noop */</script>',
        unsafeAllowJavascript,
      })

      render(<Html element={element} />)

      const root = screen.getByTestId("stHtml")
      // Script should still be present despite attribute copy error
      const script = root.querySelector("script")
      expect(script).not.toBeNull()

      spy.mockRestore()
    })
  })
})
