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

import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest"

import { WidgetStateManager } from "~lib/WidgetStateManager"

import { useQueryParamBinding } from "./useQueryParamBinding"

describe("useQueryParamBinding", () => {
  let mockWidgetMgr: {
    registerQueryParamBinding: Mock
    unregisterQueryParamBinding: Mock
  }

  beforeEach(() => {
    mockWidgetMgr = {
      registerQueryParamBinding: vi.fn(),
      unregisterQueryParamBinding: vi.fn(),
    }
  })

  it("registers binding when queryParamKey is provided", () => {
    renderHook(() =>
      useQueryParamBinding(
        mockWidgetMgr as unknown as WidgetStateManager,
        "widget-123",
        "my_key",
        "string_value",
        "default",
        false
      )
    )

    expect(mockWidgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      "widget-123",
      "my_key",
      "string_value",
      "default",
      false,
      undefined
    )
  })

  it("does not register when queryParamKey is undefined", () => {
    renderHook(() =>
      useQueryParamBinding(
        mockWidgetMgr as unknown as WidgetStateManager,
        "widget-123",
        undefined,
        "string_value",
        "default",
        false
      )
    )

    expect(mockWidgetMgr.registerQueryParamBinding).not.toHaveBeenCalled()
  })

  it("unregisters binding on unmount", () => {
    const { unmount } = renderHook(() =>
      useQueryParamBinding(
        mockWidgetMgr as unknown as WidgetStateManager,
        "widget-123",
        "my_key",
        "bool_value",
        false,
        false
      )
    )

    expect(mockWidgetMgr.unregisterQueryParamBinding).not.toHaveBeenCalled()

    unmount()

    expect(mockWidgetMgr.unregisterQueryParamBinding).toHaveBeenCalledWith(
      "widget-123"
    )
  })

  it("does not unregister on unmount when queryParamKey is undefined", () => {
    const { unmount } = renderHook(() =>
      useQueryParamBinding(
        mockWidgetMgr as unknown as WidgetStateManager,
        "widget-123",
        undefined,
        "bool_value",
        false,
        false
      )
    )

    unmount()

    expect(mockWidgetMgr.unregisterQueryParamBinding).not.toHaveBeenCalled()
  })

  it("passes urlFormat option correctly", () => {
    renderHook(() =>
      useQueryParamBinding(
        mockWidgetMgr as unknown as WidgetStateManager,
        "widget-123",
        "tags",
        "string_array_value",
        [],
        true,
        { urlFormat: "comma" }
      )
    )

    expect(mockWidgetMgr.registerQueryParamBinding).toHaveBeenCalledWith(
      "widget-123",
      "tags",
      "string_array_value",
      [],
      true,
      "comma"
    )
  })

  it("re-registers when queryParamKey changes", () => {
    const { rerender } = renderHook(
      ({ queryParamKey }: { queryParamKey: string | undefined }) =>
        useQueryParamBinding(
          mockWidgetMgr as unknown as WidgetStateManager,
          "widget-123",
          queryParamKey,
          "string_value",
          "default",
          false
        ),
      { initialProps: { queryParamKey: "key1" } }
    )

    expect(mockWidgetMgr.registerQueryParamBinding).toHaveBeenCalledTimes(1)

    rerender({ queryParamKey: "key2" })

    // Should unregister old and register new
    expect(mockWidgetMgr.unregisterQueryParamBinding).toHaveBeenCalledWith(
      "widget-123"
    )
    expect(mockWidgetMgr.registerQueryParamBinding).toHaveBeenCalledTimes(2)
  })
})
