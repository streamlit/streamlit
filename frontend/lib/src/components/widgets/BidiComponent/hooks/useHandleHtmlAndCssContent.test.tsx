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

import type { MutableRefObject, RefObject } from "react"
import { ReactNode } from "react"

import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  BidiComponentContext,
  BidiComponentContextShape,
} from "~lib/components/widgets/BidiComponent/BidiComponentContext"
import { LOG } from "~lib/components/widgets/BidiComponent/utils/logger"
import { ComponentRegistry } from "~lib/components/widgets/CustomComponent/ComponentRegistry"
import { mockEndpoints } from "~lib/mocks/mocks"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { useHandleHtmlAndCssContent } from "./useHandleHtmlAndCssContent"

const buildContextValue = (
  overrides: Partial<BidiComponentContextShape> = {}
): BidiComponentContextShape => ({
  componentName: "test-component",
  componentRegistry: new ComponentRegistry(mockEndpoints()),
  cssContent: undefined,
  cssSourcePath: undefined,
  data: undefined,
  fragmentId: undefined,
  getWidgetValue: () => ({}),
  htmlContent: undefined,
  id: "test-id",
  formId: undefined,
  jsContent: undefined,
  jsSourcePath: undefined,
  theme: {} as BidiComponentContextShape["theme"],
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  ...overrides,
})

type RenderHookOptions = {
  context: BidiComponentContextShape
  containerRef: RefObject<HTMLElement | ShadowRoot>
  setError: (error: Error) => void
  skip?: boolean
}

const renderUseHandleHtmlAndCssContent = (
  options: RenderHookOptions
): ReturnType<
  typeof renderHook<MutableRefObject<HTMLDivElement | null>, RenderHookOptions>
> =>
  renderHook(
    ({ containerRef, setError, skip }) =>
      useHandleHtmlAndCssContent({ containerRef, setError, skip }),
    {
      initialProps: options,
      wrapper: ({ children }: { children: ReactNode }) => (
        <BidiComponentContext.Provider value={options.context}>
          {children}
        </BidiComponentContext.Provider>
      ),
    }
  )

describe("useHandleHtmlAndCssContent", () => {
  let parent: HTMLDivElement
  let containerRef: RefObject<HTMLElement>
  let setError: ReturnType<typeof vi.fn<(error: Error) => void>>

  beforeEach(() => {
    parent = document.createElement("div")
    document.body.appendChild(parent)
    containerRef = { current: parent }
    setError = vi.fn<(error: Error) => void>()
    // Silence error/warn logs from handleError and the innerHTML fallback so
    // they do not pollute the test runner output.
    vi.spyOn(LOG, "error").mockImplementation(() => {})
    vi.spyOn(LOG, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    if (parent.isConnected) {
      parent.remove()
    }
    vi.restoreAllMocks()
  })

  it("injects html content into the parent container", () => {
    renderUseHandleHtmlAndCssContent({
      context: buildContextValue({ htmlContent: "<p>hello</p>" }),
      containerRef,
      setError,
    })

    expect(parent.querySelector("p")?.textContent).toBe("hello")
    expect(setError).not.toHaveBeenCalled()
  })

  it("falls back to innerHTML when createContextualFragment throws", () => {
    const originalCreateRange = document.createRange
    document.createRange = vi.fn(() => {
      const range = originalCreateRange.call(document)
      range.createContextualFragment = () => {
        throw new Error("boom")
      }
      return range
    }) as unknown as typeof document.createRange

    try {
      renderUseHandleHtmlAndCssContent({
        context: buildContextValue({ htmlContent: "<span>fallback</span>" }),
        containerRef,
        setError,
      })

      expect(parent.querySelector("span")?.textContent).toBe("fallback")
      expect(setError).not.toHaveBeenCalled()
    } finally {
      document.createRange = originalCreateRange
    }
  })

  it("appends a style element when cssContent is provided", () => {
    renderUseHandleHtmlAndCssContent({
      context: buildContextValue({
        htmlContent: "<p>styled</p>",
        cssContent: "p { color: red; }",
      }),
      containerRef,
      setError,
    })

    expect(parent.querySelector("style")?.textContent).toBe(
      "p { color: red; }"
    )
  })

  it("appends a link element with onerror handler when cssSourcePath is set", () => {
    const context = buildContextValue({ cssSourcePath: "styles.css" })
    const cssUrl = "https://example.com/styles.css"
    vi.spyOn(context.componentRegistry, "getBidiComponentURL").mockReturnValue(
      cssUrl
    )

    renderUseHandleHtmlAndCssContent({ context, containerRef, setError })

    const link = parent.querySelector("link")
    expect(link).not.toBeNull()
    expect(link?.rel).toBe("stylesheet")
    expect(link?.href).toBe(cssUrl)

    link?.dispatchEvent(new Event("error"))
    expect(setError).toHaveBeenCalledTimes(1)
    const errorArg = setError.mock.calls[0][0]
    expect(errorArg).toBeInstanceOf(Error)
    expect(errorArg.message).toMatch(/Failed to load CSS/)
  })

  it("prefers cssContent over cssSourcePath when both are provided", () => {
    const context = buildContextValue({
      cssContent: "p { color: red; }",
      cssSourcePath: "styles.css",
    })
    vi.spyOn(context.componentRegistry, "getBidiComponentURL").mockReturnValue(
      "https://example.com/styles.css"
    )

    renderUseHandleHtmlAndCssContent({ context, containerRef, setError })

    expect(parent.querySelector("style")?.textContent).toBe(
      "p { color: red; }"
    )
    // Inline cssContent wins; we should not also inject a link element.
    expect(parent.querySelector("link")).toBeNull()
  })

  it("skips rendering when the skip flag is true", () => {
    renderUseHandleHtmlAndCssContent({
      context: buildContextValue({ htmlContent: "<p>should not render</p>" }),
      containerRef,
      setError,
      skip: true,
    })

    expect(parent.querySelector("p")).toBeNull()
    expect(setError).not.toHaveBeenCalled()
  })

  it("returns early without crashing when containerRef is empty", () => {
    const { result } = renderUseHandleHtmlAndCssContent({
      context: buildContextValue({ htmlContent: "<p>noop</p>" }),
      containerRef: { current: null } as RefObject<HTMLElement>,
      setError,
    })

    expect(result.current.current).toBeNull()
    expect(setError).not.toHaveBeenCalled()
  })

  it("calls setError when html injection throws", () => {
    // Force the final parent.appendChild call to throw so the outer catch
    // handler runs (the innerHTML fallback in injectHtmlContent does not throw).
    const appendSpy = vi
      .spyOn(parent, "appendChild")
      .mockImplementation(() => {
        throw new Error("appendChild failure")
      })

    try {
      renderUseHandleHtmlAndCssContent({
        context: buildContextValue({ htmlContent: "<p>broken</p>" }),
        containerRef,
        setError,
      })

      expect(setError).toHaveBeenCalledTimes(1)
      const errorArg = setError.mock.calls[0][0]
      expect(errorArg).toBeInstanceOf(Error)
      expect(errorArg.message).toBe("appendChild failure")
    } finally {
      appendSpy.mockRestore()
    }
  })
})
