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

import React, { useMemo } from "react"

import { renderHook } from "@testing-library/react"

import {
  LibContext,
  mockTheme,
  ThemeProvider,
  WindowDimensionsProvider,
} from "@streamlit/lib"
import type { LibContextProps } from "@streamlit/lib"

import { useCrossOriginAttribute } from "./useCrossOriginAttribute"

// Returns wrapper component to provide context
const getWrapper = (
  resourceCrossOriginMode: undefined | "anonymous" | "use-credentials"
): React.FC<{ children: React.ReactNode }> => {
  return ({ children }: { children: React.ReactNode }): JSX.Element => {
    const libContextValue = useMemo(
      () =>
        ({
          libConfig: { resourceCrossOriginMode },
        }) as unknown as LibContextProps,
      []
    )
    return (
      <LibContext.Provider value={libContextValue}>
        <ThemeProvider theme={mockTheme.emotion}>
          <WindowDimensionsProvider>{children}</WindowDimensionsProvider>
        </ThemeProvider>
      </LibContext.Provider>
    )
  }
}

describe("useCrossOriginAttribute", () => {
  afterEach(() => {
    window.__streamlit = undefined
  })

  it("returns undefined when url parameter is undefined", () => {
    const { result } = renderHook(() => useCrossOriginAttribute(undefined), {
      wrapper: getWrapper(undefined),
    })
    expect(result.current).toBeUndefined()
  })

  describe("with BACKEND_BASE_URL set", () => {
    beforeEach(() => {
      window.__streamlit = {
        BACKEND_BASE_URL: "https://backend.example.com:8080/app",
      }
    })

    it.each([
      ["anonymous", "anonymous"],
      ["use-credentials", "use-credentials"],
      [undefined, undefined],
    ] as const)(
      "returns %s when resourceCrossOriginMode is %s for same origin URL",
      (expected, resourceCrossOriginMode) => {
        const { result } = renderHook(
          () =>
            useCrossOriginAttribute(
              "https://backend.example.com:8080/some/path/image.png"
            ),
          { wrapper: getWrapper(resourceCrossOriginMode) }
        )
        expect(result.current).toBe(expected)
      }
    )

    it("returns resourceCrossOriginMode for exact backend base URL", () => {
      const { result } = renderHook(
        () => useCrossOriginAttribute("https://backend.example.com:8080/app"),
        { wrapper: getWrapper("anonymous") }
      )
      expect(result.current).toBe("anonymous")
    })

    it.each([
      ["anonymous", "anonymous"],
      ["use-credentials", "use-credentials"],
      [undefined, undefined],
    ] as const)(
      "returns %s when resourceCrossOriginMode is %s for relative filename",
      (expected, resourceCrossOriginMode) => {
        const { result } = renderHook(
          () => useCrossOriginAttribute("image.png"),
          { wrapper: getWrapper(resourceCrossOriginMode) }
        )
        expect(result.current).toBe(expected)
      }
    )

    it.each([
      ["anonymous", "anonymous"],
      ["use-credentials", "use-credentials"],
      [undefined, undefined],
    ] as const)(
      "returns %s when resourceCrossOriginMode is %s for relative path",
      (expected, resourceCrossOriginMode) => {
        const { result } = renderHook(
          () => useCrossOriginAttribute("/some/relative/path"),
          { wrapper: getWrapper(resourceCrossOriginMode) }
        )
        expect(result.current).toBe(expected)
      }
    )

    it.each([
      ["anonymous", "anonymous"],
      ["use-credentials", "use-credentials"],
      [undefined, undefined],
    ] as const)(
      "returns %s when resourceCrossOriginMode is %s for domain-like string without protocol",
      (expected, resourceCrossOriginMode) => {
        // This should be treated as relative since it lacks protocol
        const { result } = renderHook(
          () => useCrossOriginAttribute("www.example.com/some-image.png"),
          { wrapper: getWrapper(resourceCrossOriginMode) }
        )
        expect(result.current).toBe(expected)
      }
    )

    it("returns resourceCrossOriginMode for same BACKEND_BASE_URL origin with different path", () => {
      const { result } = renderHook(
        () =>
          useCrossOriginAttribute(
            "https://backend.example.com:8080/different/path"
          ),
        { wrapper: getWrapper("use-credentials") }
      )
      expect(result.current).toBe("use-credentials")
    })

    it.each(["anonymous", "use-credentials", undefined] as const)(
      "returns undefined for different hostname regardless of resourceCrossOriginMode %s",
      resourceCrossOriginMode => {
        const { result } = renderHook(
          () =>
            useCrossOriginAttribute(
              "https://external.example.com:8080/image.png"
            ),
          { wrapper: getWrapper(resourceCrossOriginMode) }
        )
        expect(result.current).toBeUndefined()
      }
    )

    it.each(["anonymous", "use-credentials", undefined] as const)(
      "returns undefined for different port regardless of resourceCrossOriginMode %s",
      resourceCrossOriginMode => {
        const { result } = renderHook(
          () =>
            useCrossOriginAttribute(
              "https://backend.example.com:9000/image.png"
            ),
          { wrapper: getWrapper(resourceCrossOriginMode) }
        )
        expect(result.current).toBeUndefined()
      }
    )

    it.each(["anonymous", "use-credentials", undefined] as const)(
      "returns undefined for different protocol regardless of resourceCrossOriginMode %s",
      resourceCrossOriginMode => {
        const { result } = renderHook(
          () =>
            useCrossOriginAttribute(
              "http://backend.example.com:8080/image.png"
            ),
          { wrapper: getWrapper(resourceCrossOriginMode) }
        )
        expect(result.current).toBeUndefined()
      }
    )
  })

  describe("without backend base URL configured", () => {
    it.each(["anonymous", "use-credentials", undefined] as const)(
      "returns undefined for absolute URLs when no backend base URL is set regardless of resourceCrossOriginMode %s",
      resourceCrossOriginMode => {
        const { result } = renderHook(
          () =>
            useCrossOriginAttribute("https://external.example.com/image.png"),
          { wrapper: getWrapper(resourceCrossOriginMode) }
        )
        expect(result.current).toBeUndefined()
      }
    )

    it.each(["anonymous", "use-credentials", undefined] as const)(
      "returns undefined for relative URLs when no backend base URL is set regardless of resourceCrossOriginMode %s",
      resourceCrossOriginMode => {
        const { result } = renderHook(
          () => useCrossOriginAttribute("/relative/path"),
          { wrapper: getWrapper(resourceCrossOriginMode) }
        )
        expect(result.current).toBeUndefined()
      }
    )
  })

  describe("with backend base URL having empty BACKEND_BASE_URL", () => {
    it("returns undefined for absolute URLs not matching window.location.origin when backend base URL is empty string", () => {
      const { result } = renderHook(
        () =>
          useCrossOriginAttribute("https://external.example.com/image.png"),
        { wrapper: getWrapper("anonymous") }
      )
      expect(result.current).toBeUndefined()
    })
  })

  describe("edge cases", () => {
    beforeEach(() => {
      window.__streamlit = {
        BACKEND_BASE_URL: "https://backend.example.com/app",
      }
    })

    it("handles URLs with query parameters and fragments", () => {
      const { result } = renderHook(
        () =>
          useCrossOriginAttribute(
            "https://backend.example.com/image.png?v=123#section"
          ),
        { wrapper: getWrapper("anonymous") }
      )
      expect(result.current).toBe("anonymous")
    })

    it("handles backend base URL with default HTTPS port", () => {
      window.__streamlit = {
        BACKEND_BASE_URL: "https://backend.example.com/app",
      }
      const { result } = renderHook(
        () =>
          useCrossOriginAttribute("https://backend.example.com:443/image.png"),
        { wrapper: getWrapper("anonymous") }
      )
      expect(result.current).toBe("anonymous")
    })

    it("handles backend base URL with default HTTP port", () => {
      window.__streamlit = {
        BACKEND_BASE_URL: "http://backend.example.com/app",
      }
      const { result } = renderHook(
        () =>
          useCrossOriginAttribute("http://backend.example.com:80/image.png"),
        { wrapper: getWrapper("anonymous") }
      )
      expect(result.current).toBe("anonymous")
    })
  })
})
