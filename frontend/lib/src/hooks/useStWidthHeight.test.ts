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

import { renderHook } from "@testing-library/react"

import { useStWidthHeight } from "./useStWidthHeight"

describe("#useStWidthHeight", () => {
  describe("width", () => {
    it.each([
      [
        "should return 100% width when shouldUseContainerWidth is true",
        {
          container: { width: 200, height: 200 },
          element: { width: 100, height: 100 },
          isFullScreen: false,
          shouldUseContainerWidth: true,
        },
        "100%",
      ],
      [
        "should return 100% width when isFullScreen is true",
        {
          container: { width: 200, height: 200 },
          element: { width: 100, height: 100 },
          isFullScreen: true,
          shouldUseContainerWidth: false,
        },
        "100%",
      ],
      [
        "should return element width when both shouldUseContainerWidth and isFullScreen are false",
        {
          container: { width: 200, height: 200 },
          element: { width: 100, height: 100 },
          isFullScreen: false,
          shouldUseContainerWidth: false,
        },
        100,
      ],
      [
        "should return 100% width when both shouldUseContainerWidth and isFullScreen are true",
        {
          container: { width: 200, height: 200 },
          element: { width: 100, height: 100 },
          isFullScreen: true,
          shouldUseContainerWidth: true,
        },
        "100%",
      ],
      [
        "should return container width when element width is not provided",
        {
          container: { width: 200, height: 200 },
          element: { height: 100 },
          isFullScreen: false,
          shouldUseContainerWidth: false,
        },
        200,
      ],
      [
        "should return widthFallback when neither element nor container width is provided",
        {
          container: {},
          element: {},
          isFullScreen: false,
          shouldUseContainerWidth: false,
          widthFallback: 150,
        },
        150,
      ],
      [
        "should return auto when neither element nor container width is provided and no widthFallback is given",
        {
          container: {},
          element: {},
          isFullScreen: false,
          shouldUseContainerWidth: false,
        },
        "auto",
      ],
    ])("%s", (_, props, expectedWidth) => {
      const { result } = renderHook(() => useStWidthHeight(props))
      expect(result.current.width).toBe(expectedWidth)
    })
  })

  describe("height", () => {
    it.each([
      [
        "should return container height when isFullScreen is true and container height is provided",
        {
          container: { height: 200 },
          element: { height: 100 },
          isFullScreen: true,
          shouldUseContainerWidth: false,
        },
        200,
      ],
      [
        "should return element height when isFullScreen is false",
        {
          container: { height: 200 },
          element: { height: 100 },
          isFullScreen: false,
          shouldUseContainerWidth: false,
        },
        100,
      ],
      [
        "should return heightFallback when neither element nor container height is provided",
        {
          container: {},
          element: {},
          isFullScreen: false,
          shouldUseContainerWidth: false,
          heightFallback: 150,
        },
        150,
      ],
      [
        "should return auto when neither element nor container width is provided and no widthFallback is given",
        {
          container: {},
          element: {},
          isFullScreen: false,
          shouldUseContainerWidth: false,
        },
        "auto",
      ],
    ])("%s", (_, props, expectedHeight) => {
      const { result } = renderHook(() => useStWidthHeight(props))
      expect(result.current.height).toBe(expectedHeight)
    })
  })
})
