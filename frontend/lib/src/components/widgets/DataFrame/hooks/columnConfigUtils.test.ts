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

import { updateColumnConfigTypeProps } from "./columnConfigUtils"
import { ColumnConfigProps } from "./useColumnLoader"

describe("updateColumnConfigTypeProps", () => {
  it("should create new column config when none exists", () => {
    const columnId = "col1"
    const initialMapping = new Map<string, ColumnConfigProps>()
    const updatedProps = {
      label: "Number Column",
      type_config: { format: "%.2f" },
    }

    const result = updateColumnConfigTypeProps({
      columnId,
      columnConfigMapping: initialMapping,
      updatedProps,
    })

    expect(result.get(columnId)).toEqual({
      label: "Number Column",
      type_config: { format: "%.2f" },
    })
  })

  it("should update existing column config", () => {
    const columnId = "col1"
    const initialMapping = new Map<string, ColumnConfigProps>([
      [
        columnId,
        {
          label: "Original Label",
          type_config: { format: "%.2f" },
          width: "medium",
        },
      ],
    ])
    const updatedProps: ColumnConfigProps = {
      type_config: { format: "%.3f" },
      width: "large",
    }

    const result = updateColumnConfigTypeProps({
      columnId,
      columnConfigMapping: initialMapping,
      updatedProps,
    })

    expect(result.get(columnId)).toEqual({
      label: "Original Label",
      type_config: { format: "%.3f" },
      width: "large",
    })
  })

  it("should merge type_config with existing config", () => {
    const columnId = "col1"
    const initialMapping = new Map<string, ColumnConfigProps>([
      [
        columnId,
        {
          type_config: { format: "%.2f", min: 0 },
          alignment: "right",
        },
      ],
    ])
    const updatedProps = {
      type_config: { format: "%.3f", max: 100 },
    }

    const result = updateColumnConfigTypeProps({
      columnId,
      columnConfigMapping: initialMapping,
      updatedProps,
    })

    expect(result.get(columnId)).toEqual({
      type_config: { format: "%.3f", min: 0, max: 100 },
      alignment: "right",
    })
  })

  it("should handle undefined updatedProps", () => {
    const columnId = "col1"
    const initialMapping = new Map<string, ColumnConfigProps>([
      [
        columnId,
        {
          label: "Test Column",
          type_config: { format: "%.2f" },
        },
      ],
    ])

    const result = updateColumnConfigTypeProps({
      columnId,
      columnConfigMapping: initialMapping,
    })

    expect(result.get(columnId)).toEqual({
      label: "Test Column",
      type_config: { format: "%.2f" },
    })
  })

  it("should not modify original mapping", () => {
    const columnId = "col1"
    const initialMapping = new Map<string, ColumnConfigProps>([
      [
        columnId,
        {
          label: "Test Column",
          type_config: { format: "%.2f" },
          alignment: "right",
        },
      ],
    ])
    const updatedProps: ColumnConfigProps = {
      type_config: { format: "%.3f" },
      alignment: "left",
    }

    const result = updateColumnConfigTypeProps({
      columnId,
      columnConfigMapping: initialMapping,
      updatedProps,
    })

    // Check original mapping wasn't modified
    expect(initialMapping.get(columnId)).toEqual({
      label: "Test Column",
      type_config: { format: "%.2f" },
      alignment: "right",
    })
    expect(result).not.toBe(initialMapping)
  })
})
