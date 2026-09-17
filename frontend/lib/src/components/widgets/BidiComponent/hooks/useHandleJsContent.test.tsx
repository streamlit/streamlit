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

import type { ReactNode, RefObject } from "react"

import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  BidiComponentContext,
  BidiComponentContextShape,
} from "~lib/components/widgets/BidiComponent/BidiComponentContext"
import { LOG } from "~lib/components/widgets/BidiComponent/utils/logger"
import { ComponentRegistry } from "~lib/components/widgets/CustomComponent/ComponentRegistry"
import { mockEndpoints } from "~lib/mocks/mocks"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { useHandleJsContent } from "./useHandleJsContent"

const SCRIPT_SRC = "https://example.com/script.js"

const buildContextValue = (
  overrides: Partial<BidiComponentContextShape> = {}
): BidiComponentContextShape => {
  const componentRegistry = new ComponentRegistry(mockEndpoints())
  vi.spyOn(componentRegistry, "getBidiComponentURL").mockReturnValue(
    SCRIPT_SRC
  )

  return {
    componentName: "test-component",
    componentRegistry,
    cssContent: undefined,
    cssSourcePath: undefined,
    data: undefined,
    fragmentId: undefined,
    getWidgetValue: () => ({}),
    htmlContent: undefined,
    id: "test-id",
    formId: undefined,
    jsContent: undefined,
    jsSourcePath: "script.js",
    theme: {} as BidiComponentContextShape["theme"],
    widgetMgr: new WidgetStateManager({
      sendRerunBackMsg: vi.fn(),
      formsDataChanged: vi.fn(),
    }),
    ...overrides,
  }
}

type RenderHookOptions = {
  context: BidiComponentContextShape
  containerRef: RefObject<HTMLElement | ShadowRoot>
  setError: (error: Error) => void
  skip?: boolean
}

const renderUseHandleJsContent = (
  options: RenderHookOptions
): ReturnType<typeof renderHook<void, RenderHookOptions>> => {
  const contextRef = { current: options.context }

  return renderHook(
    ({ containerRef, setError, skip }) =>
      useHandleJsContent({ containerRef, setError, skip }),
    {
      initialProps: options,
      wrapper: ({ children }: { children: ReactNode }) => (
        <BidiComponentContext.Provider value={contextRef.current}>
          {children}
        </BidiComponentContext.Provider>
      ),
    }
  )
}

const queryExternalScripts = (): NodeListOf<HTMLScriptElement> =>
  document.querySelectorAll(`script[src="${SCRIPT_SRC}"]`)

describe("useHandleJsContent", () => {
  let parent: HTMLDivElement
  let containerRef: RefObject<HTMLElement>
  let setError: ReturnType<typeof vi.fn<(error: Error) => void>>

  beforeEach(() => {
    parent = document.createElement("div")
    document.body.appendChild(parent)
    containerRef = { current: parent }
    setError = vi.fn<(error: Error) => void>()
    vi.spyOn(LOG, "error").mockImplementation(() => {})
    vi.spyOn(LOG, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    if (parent.isConnected) {
      parent.remove()
    }
    queryExternalScripts().forEach(script => script.remove())
    vi.restoreAllMocks()
  })

  it("creates an external module script for jsSourcePath", () => {
    renderUseHandleJsContent({
      context: buildContextValue(),
      containerRef,
      setError,
    })

    expect(queryExternalScripts()).toHaveLength(1)
    expect(setError).not.toHaveBeenCalled()
  })

  it("reports a live script load error", async () => {
    renderUseHandleJsContent({
      context: buildContextValue(),
      containerRef,
      setError,
    })

    const script = queryExternalScripts()[0]
    expect(script).toBeDefined()
    expect(script.isConnected).toBe(true)

    script.dispatchEvent(new Event("error"))

    await waitFor(() => {
      expect(setError).toHaveBeenCalledTimes(1)
    })
    const errorArg = setError.mock.calls[0][0]
    expect(errorArg).toBeInstanceOf(Error)
    expect(errorArg.message).toMatch(/Failed to load script from/)
  })

  it("settles a pending load on cleanup without treating it as an error", async () => {
    const { unmount } = renderUseHandleJsContent({
      context: buildContextValue(),
      containerRef,
      setError,
    })

    const script = queryExternalScripts()[0]
    expect(script).toBeDefined()

    unmount()

    expect(script.isConnected).toBe(false)
    expect(queryExternalScripts()).toHaveLength(0)

    script.dispatchEvent(new Event("error"))
    script.dispatchEvent(new Event("load"))
    await Promise.resolve()

    expect(setError).not.toHaveBeenCalled()
  })

  it("replaces an in-flight script when the effect re-runs", async () => {
    const contextRef = { current: buildContextValue() }

    const { rerender } = renderHook(
      ({ containerRef: ref, setError: onError, skip }) =>
        useHandleJsContent({ containerRef: ref, setError: onError, skip }),
      {
        initialProps: { containerRef, setError, skip: false },
        wrapper: ({ children }: { children: ReactNode }) => (
          <BidiComponentContext.Provider value={contextRef.current}>
            {children}
          </BidiComponentContext.Provider>
        ),
      }
    )

    const firstScript = queryExternalScripts()[0]
    expect(firstScript).toBeDefined()

    contextRef.current = buildContextValue({
      theme: { primaryColor: "#fff" } as BidiComponentContextShape["theme"],
    })
    rerender({ containerRef, setError, skip: false })
    await Promise.resolve()

    expect(firstScript.isConnected).toBe(false)
    expect(queryExternalScripts()).toHaveLength(1)
    expect(setError).not.toHaveBeenCalled()
  })
})
