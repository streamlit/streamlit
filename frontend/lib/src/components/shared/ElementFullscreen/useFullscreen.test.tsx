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

import { act, renderHook, RenderHookResult } from "@testing-library/react"

import { TestAppWrapper } from "~lib/test_util"

import { useFullscreen } from "./useFullscreen"

function renderUseFullscreen(): RenderHookResult<
  ReturnType<typeof useFullscreen>,
  unknown
> {
  return renderHook(() => useFullscreen(), { wrapper: TestAppWrapper })
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
    const { result } = renderUseFullscreen()

    expect(result.current.expanded).toBe(false)

    act(() => {
      result.current.zoomIn()
    })

    expect(result.current.expanded).toBe(true)
    expect(document.body.style.overflow).toBe("hidden")

    act(() => {
      result.current.zoomOut()
    })

    expect(result.current.expanded).toBe(false)
    expect(document.body.style.overflow).toBe("unset")
  })

  it("exits fullscreen when Escape is pressed while expanded", () => {
    const { result } = renderUseFullscreen()

    act(() => {
      result.current.zoomIn()
    })
    expect(result.current.expanded).toBe(true)

    act(() => {
      dispatchEscapeKey()
    })

    expect(result.current.expanded).toBe(false)
    expect(document.body.style.overflow).toBe("unset")
  })

  it("does not change state when Escape is pressed while collapsed", () => {
    const { result } = renderUseFullscreen()

    act(() => {
      dispatchEscapeKey()
    })

    expect(result.current.expanded).toBe(false)
  })
})
