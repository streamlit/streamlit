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

import { act, renderHook } from "@testing-library/react"
import { vi } from "vitest"

import useColumnFormatting from "./useColumnFormatting"

describe("useColumnFormatting hook", () => {
  it("should correctly update column format", () => {
    const mockSetColumnConfigMapping = vi.fn()
    const { result } = renderHook(() =>
      useColumnFormatting(mockSetColumnConfigMapping)
    )

    // Change format for a column
    act(() => {
      result.current.changeColumnFormat("test_column", "dollar")
    })

    // Verify the setColumnConfigMapping was called with the correct update function
    expect(mockSetColumnConfigMapping).toHaveBeenCalled()

    // Get the update function that was passed to setColumnConfigMapping
    const updateFunction = mockSetColumnConfigMapping.mock.calls[0][0]

    // Create a mock previous state
    const prevMapping = new Map()

    // Apply the update function
    const newMapping = updateFunction(prevMapping)

    // Verify the new mapping has the correct format
    const columnConfig = newMapping.get("test_column")
    expect(columnConfig).toBeDefined()
    expect(columnConfig.type_config.format).toBe("dollar")
  })

  it("should update existing column config", () => {
    const mockSetColumnConfigMapping = vi.fn()
    const { result } = renderHook(() =>
      useColumnFormatting(mockSetColumnConfigMapping)
    )

    // Create an initial mapping with existing config
    const initialMapping = new Map()
    initialMapping.set("test_column", {
      type_config: {
        format: "euro",
        other_prop: "value",
      },
      other_config: "value",
    })

    // Change format for the column
    act(() => {
      result.current.changeColumnFormat("test_column", "percent")
    })

    // Get and apply the update function
    const updateFunction = mockSetColumnConfigMapping.mock.calls[0][0]
    const newMapping = updateFunction(initialMapping)

    // Verify the new mapping has updated format but preserved other properties
    const columnConfig = newMapping.get("test_column")
    expect(columnConfig).toBeDefined()
    expect(columnConfig.type_config.format).toBe("percent")
    expect(columnConfig.type_config.other_prop).toBe("value")
    expect(columnConfig.other_config).toBe("value")
  })
})
