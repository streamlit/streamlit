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

import { type Table, tableFromIPC } from "apache-arrow"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ARROW_REF_KEY } from "~lib/components/widgets/BidiComponent/constants"

import { reconstructMixedData } from "./reconstructMixedData"

vi.mock("apache-arrow", () => ({
  tableFromIPC: vi.fn(),
}))

const mockedTableFromIPC = vi.mocked(tableFromIPC)

describe("reconstructMixedData", () => {
  beforeEach(() => {
    mockedTableFromIPC.mockReset()
  })

  it("returns primitive data as-is", () => {
    const data = "plain text"

    const result = reconstructMixedData(data, {})

    expect(result).toBe(data)
    expect(mockedTableFromIPC).not.toHaveBeenCalled()
  })

  it("returns arrays unchanged", () => {
    const data = [1, 2, 3]

    const result = reconstructMixedData(data, {})

    expect(result).toBe(data)
    expect(mockedTableFromIPC).not.toHaveBeenCalled()
  })

  it("processes objects with non-string ref key values as regular objects", () => {
    const data = {
      [ARROW_REF_KEY]: 123,
    }

    const result = reconstructMixedData(data, {})

    expect(result).toEqual(data)
    expect(mockedTableFromIPC).not.toHaveBeenCalled()
  })

  it("reconstructs a root-level Arrow reference", () => {
    const refId = "root-table"
    const arrowBytes = new Uint8Array([1, 2, 3])
    const mockTable = { id: "table" } as unknown as Table

    mockedTableFromIPC.mockReturnValue(mockTable)

    const result = reconstructMixedData(
      { [ARROW_REF_KEY]: refId },
      {
        [refId]: arrowBytes,
      }
    )

    expect(result).toBe(mockTable)
    expect(mockedTableFromIPC).toHaveBeenCalledTimes(1)
    expect(mockedTableFromIPC).toHaveBeenCalledWith(arrowBytes)
  })

  it("returns null when Arrow bytes are missing for a root-level reference", () => {
    const refId = "missing-bytes"

    const result = reconstructMixedData({ [ARROW_REF_KEY]: refId }, {})

    expect(result).toBeNull()
    expect(mockedTableFromIPC).not.toHaveBeenCalled()
  })

  it("returns null when parsing Arrow bytes throws", () => {
    const refId = "parse-error"
    const arrowBytes = new Uint8Array([1])

    mockedTableFromIPC.mockImplementation(() => {
      throw new Error("failed to parse")
    })

    const result = reconstructMixedData(
      { [ARROW_REF_KEY]: refId },
      {
        [refId]: arrowBytes,
      }
    )

    expect(result).toBeNull()
    expect(mockedTableFromIPC).toHaveBeenCalledTimes(1)
    expect(mockedTableFromIPC).toHaveBeenCalledWith(arrowBytes)
  })

  it("sets first-level properties to null when parsing fails", () => {
    const refId = "property-parse-error"
    const arrowBytes = new Uint8Array([4, 5, 6])

    mockedTableFromIPC.mockImplementation(() => {
      throw new Error("failed to parse")
    })

    const data = {
      table: { [ARROW_REF_KEY]: refId },
    }

    const result = reconstructMixedData(data, {
      [refId]: arrowBytes,
    })

    expect(result).toEqual({
      table: null,
    })
    expect(mockedTableFromIPC).toHaveBeenCalledTimes(1)
    expect(mockedTableFromIPC).toHaveBeenCalledWith(arrowBytes)
  })

  it("only replaces first-level Arrow references in objects", () => {
    const firstLevelRef = "first-level"
    const missingRef = "missing"
    const nestedRef = "nested"
    const arrowBytes = new Uint8Array([9, 9])
    const mockTable = { id: "first" } as unknown as Table

    mockedTableFromIPC.mockReturnValue(mockTable)

    const data = {
      first: { [ARROW_REF_KEY]: firstLevelRef },
      second: { [ARROW_REF_KEY]: missingRef },
      nested: {
        levelTwo: { [ARROW_REF_KEY]: nestedRef },
      },
      list: [{ [ARROW_REF_KEY]: nestedRef }],
      value: 42,
    }

    const result = reconstructMixedData(data, {
      [firstLevelRef]: arrowBytes,
    })

    expect(result).toEqual({
      first: mockTable,
      second: null,
      nested: data.nested,
      list: data.list,
      value: 42,
    })
    expect(mockedTableFromIPC).toHaveBeenCalledTimes(1)
    expect(mockedTableFromIPC).toHaveBeenCalledWith(arrowBytes)
  })
})
