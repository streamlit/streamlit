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

import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  parseBidiComponentData,
  type ParseBidiComponentDataArgs,
} from "./parseBidiComponentData"
import { reconstructMixedData } from "./reconstructMixedData"

vi.mock("./reconstructMixedData")

const mockedReconstructMixedData = vi.mocked(reconstructMixedData)

const createArgs = (
  overrides: Partial<ParseBidiComponentDataArgs> = {}
): ParseBidiComponentDataArgs => ({
  data: undefined,
  json: undefined,
  arrowData: undefined,
  bytes: undefined,
  mixedJson: undefined,
  arrowBlobs: undefined,
  ...overrides,
})

describe("parseBidiComponentData", () => {
  beforeEach(() => {
    mockedReconstructMixedData.mockReset()
  })

  it.each([
    {
      description: "parses json data when provided",
      args: createArgs({ data: "json", json: '{"foo": 1}' }),
      expected: { foo: 1 },
    },
    {
      description: "returns null for json data when the payload is empty",
      args: createArgs({ data: "json", json: "" }),
      expected: null,
    },
    {
      description: "returns arrow data bytes when provided",
      args: createArgs({
        data: "arrowData",
        arrowData: new Uint8Array([1, 2, 3]),
      }),
      expected: new Uint8Array([1, 2, 3]),
    },
    {
      description: "returns null when arrow data is missing",
      args: createArgs({ data: "arrowData" }),
      expected: null,
    },
    {
      description: "returns raw bytes when provided",
      args: createArgs({ data: "bytes", bytes: new Uint8Array([4, 5, 6]) }),
      expected: new Uint8Array([4, 5, 6]),
    },
    {
      description: "returns null when bytes payload is empty",
      args: createArgs({ data: "bytes" }),
      expected: null,
    },
  ])("$description", ({ args, expected }) => {
    const result = parseBidiComponentData(args)

    if (expected instanceof Uint8Array) {
      expect(result).toBeInstanceOf(Uint8Array)
      expect(Array.from(result as Uint8Array)).toEqual(Array.from(expected))
    } else {
      expect(result).toEqual(expected)
    }
  })

  it("reconstructs mixed data when json payload exists", () => {
    const parsedJson = { foo: "bar" }
    const arrowBlobs = {
      table: { data: new Uint8Array([7, 8, 9]) },
    }
    mockedReconstructMixedData.mockReturnValue(parsedJson)

    const result = parseBidiComponentData(
      createArgs({
        data: "mixed",
        mixedJson: JSON.stringify(parsedJson),
        arrowBlobs,
      })
    )

    expect(mockedReconstructMixedData).toHaveBeenCalledWith(parsedJson, {
      table: arrowBlobs.table?.data,
    })
    expect(result).toEqual(parsedJson)
  })

  it("returns null when mixed json payload is missing", () => {
    const result = parseBidiComponentData(
      createArgs({
        data: "mixed",
        arrowBlobs: { table: { data: new Uint8Array([1]) } } as never,
      })
    )

    expect(mockedReconstructMixedData).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it("returns null when mixed data is missing", () => {
    const result = parseBidiComponentData(createArgs({ data: "mixed" }))

    expect(result).toBeNull()
    expect(mockedReconstructMixedData).not.toHaveBeenCalled()
  })

  it("returns null for data type 'any'", () => {
    const result = parseBidiComponentData(createArgs({ data: "any" }))

    expect(result).toBeNull()
  })

  it("returns null when data type is undefined", () => {
    const result = parseBidiComponentData(createArgs())

    expect(result).toBeNull()
  })

  it("throws when data type is unexpected", () => {
    expect(() => {
      parseBidiComponentData(createArgs({ data: "unexpected" as never }))
    }).toThrowErrorMatchingInlineSnapshot(
      `[Error: Reached a branch with non-exhaustive item: unexpected]`
    )
  })
})
