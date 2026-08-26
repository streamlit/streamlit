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

import { PropsWithChildren, ReactElement } from "react"

import { act, renderHook, RenderHookResult } from "@testing-library/react"

import { ViewStateContext } from "~lib/components/core/ViewStateContext"
import { TestAppWrapper } from "~lib/test_util"

import { useFullscreen } from "./useFullscreen"

function renderUseFullscreen(): {
  result: RenderHookResult<ReturnType<typeof useFullscreen>, unknown>["result"]
  setFullScreen: ReturnType<typeof vi.fn>
} {
  const setFullScreen = vi.fn()
  const viewState = { isFullScreen: false, setFullScreen }

  const Wrapper = ({ children }: PropsWithChildren): ReactElement => (
    <TestAppWrapper>
      <ViewStateContext.Provider value={viewState}>
        {children}
      </ViewStateContext.Provider>
    </TestAppWrapper>
  )

  const { result } = renderHook(() => useFullscreen(), { wrapper: Wrapper })
  return { result, setFullScreen }
}

/** useFullscreen listens for keyCode 27 rather than event.key. */
function dispatchEscapeKey(): void {
  const event = new KeyboardEvent("keydown", { key: "Escape" })
  Object.defineProperty(event, "keyCode", { get: () => 27 })
  document.dispatchEvent(event)
}

describe("useFullscreen", () => {
  afterEach(() => {
    document.body.style.overflow = ""
  })

  it("zooms in and out and updates document overflow", () => {
    const { result, setFullScreen } = renderUseFullscreen()

    expect(result.current.expanded).toBe(false)

    act(() => {
      result.current.zoomIn()
    })

    expect(result.current.expanded).toBe(true)
    expect(document.body.style.overflow).toBe("hidden")
    expect(setFullScreen).toHaveBeenCalledWith(true)

    act(() => {
      result.current.zoomOut()
    })

    expect(result.current.expanded).toBe(false)
    expect(document.body.style.overflow).toBe("unset")
    expect(setFullScreen).toHaveBeenLastCalledWith(false)
  })

  it("exits fullscreen when Escape is pressed while expanded", () => {
    const { result, setFullScreen } = renderUseFullscreen()

    act(() => {
      result.current.zoomIn()
    })
    expect(result.current.expanded).toBe(true)

    act(() => {
      dispatchEscapeKey()
    })

    expect(result.current.expanded).toBe(false)
    expect(document.body.style.overflow).toBe("unset")
    expect(setFullScreen).toHaveBeenLastCalledWith(false)
  })

  it("does not change state when Escape is pressed while collapsed", () => {
    const { result, setFullScreen } = renderUseFullscreen()

    act(() => {
      dispatchEscapeKey()
    })

    expect(result.current.expanded).toBe(false)
    expect(document.body.style.overflow).toBe("")
    expect(setFullScreen).not.toHaveBeenCalled()
  })
})
