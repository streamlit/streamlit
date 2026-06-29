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

import { GridCellKind } from "@glideapps/glide-data-grid"
import { act, renderHook, waitFor } from "@testing-library/react"
import { Field, Utf8 } from "apache-arrow"
import { describe, expect, it, vi } from "vitest"

import { IDataframeChunkResponsePayload } from "@streamlit/protobuf"

import { BackendOperationClient } from "~lib/BackendOperationClient"
import {
  BaseColumn,
  isErrorCell,
  TextColumn,
} from "~lib/components/widgets/DataFrame/columns"
import { DataFrameCellType } from "~lib/dataframes/arrowTypeUtils"
import { Quiver } from "~lib/dataframes/Quiver"
import { UNICODE } from "~lib/mocks/arrow/types/unicode"

import useLazyDataLoader from "./useLazyDataLoader"

const MOCK_COLUMNS: BaseColumn[] = [
  TextColumn({
    arrowType: {
      type: DataFrameCellType.DATA,
      arrowField: new Field("index-0", new Utf8(), true),
      pandasType: {
        field_name: "index-0",
        name: "index-0",
        pandas_type: "unicode",
        numpy_type: "unicode",
        metadata: null,
      },
    },
    id: "index-0",
    name: "",
    indexNumber: 0,
    isEditable: false,
    isHidden: false,
    isIndex: true,
    isPinned: true,
    isStretched: false,
    title: "",
  }),
  TextColumn({
    arrowType: {
      type: DataFrameCellType.DATA,
      arrowField: new Field("column-c1-0", new Utf8(), true),
      pandasType: {
        field_name: "column-c1-0",
        name: "column-c1-0",
        pandas_type: "unicode",
        numpy_type: "object",
        metadata: null,
      },
    },
    id: "column-c1-0",
    name: "c1",
    indexNumber: 1,
    isEditable: false,
    isHidden: false,
    isIndex: false,
    isPinned: false,
    isStretched: false,
    title: "c1",
  }),
]

const SOURCE_ID = "source-1"
const GENERATION = "gen-1"
const PAGE_SIZE = 2

function makeClient(
  requestImpl: () => Promise<IDataframeChunkResponsePayload>
): { client: BackendOperationClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn(requestImpl)
  // Only requestDataframeChunk is used by the hook.
  const client = {
    requestDataframeChunk: request,
  } as unknown as BackendOperationClient
  return { client, request }
}

function renderLoader(client: BackendOperationClient | undefined): {
  result: { current: ReturnType<typeof useLazyDataLoader> }
} {
  const initialChunk = new Quiver({ data: UNICODE })
  return renderHook(() =>
    useLazyDataLoader({
      initialChunk,
      columns: MOCK_COLUMNS,
      numRows: 4,
      sourceId: SOURCE_ID,
      generation: GENERATION,
      pageSize: PAGE_SIZE,
      sortState: undefined,
      backendOperationClient: client,
    })
  )
}

describe("useLazyDataLoader", () => {
  it("returns cells from the seeded initial chunk", () => {
    const { client } = makeClient(() => Promise.resolve({}))
    const { result } = renderLoader(client)

    const cell = result.current.getCellContent([0, 0])
    expect(MOCK_COLUMNS[0].getCellValue(cell)).toBe("i1")
  })

  it("returns error cells for out-of-bounds indices", () => {
    const { client } = makeClient(() => Promise.resolve({}))
    const { result } = renderLoader(client)

    expect(isErrorCell(result.current.getCellContent([0, 4]))).toBe(true)
    expect(isErrorCell(result.current.getCellContent([5, 0]))).toBe(true)
  })

  it("returns a loading cell and requests the missing chunk", async () => {
    const { client, request } = makeClient(() =>
      Promise.resolve({
        sourceId: SOURCE_ID,
        generation: GENERATION,
        offset: PAGE_SIZE,
        arrowData: { data: UNICODE },
      })
    )
    const { result } = renderLoader(client)

    // Row 2 lives in chunk 1, which is not seeded.
    const loadingCell = result.current.getCellContent([0, 2])
    expect(loadingCell.kind).toBe(GridCellKind.Loading)

    // After the debounce, a chunk request is sent for the missing chunk.
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: SOURCE_ID,
        generation: GENERATION,
        offset: PAGE_SIZE,
        limit: PAGE_SIZE,
      })
    )

    // Once loaded, the cell resolves to real data.
    await waitFor(() => {
      const cell = result.current.getCellContent([0, 2])
      expect(cell.kind).not.toBe(GridCellKind.Loading)
      expect(MOCK_COLUMNS[0].getCellValue(cell)).toBe("i1")
    })
  })

  it("shows an error cell when no backend client is available", async () => {
    const { result } = renderLoader(undefined)
    // Chunk 0 is seeded, so it still renders.
    expect(
      MOCK_COLUMNS[0].getCellValue(result.current.getCellContent([0, 0]))
    ).toBe("i1")
    // Chunk 1 cannot be loaded without a client. The first lookup schedules a
    // (debounced) request which marks the chunk as failed -> error cell.
    // Wait once for the debounce to flush (re-polling would keep resetting it).
    result.current.getCellContent([0, 2])
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300))
    })
    expect(isErrorCell(result.current.getCellContent([0, 2]))).toBe(true)
  })

  it("ignores responses with a stale generation", async () => {
    const { client, request } = makeClient(() =>
      Promise.resolve({
        sourceId: SOURCE_ID,
        generation: "stale",
        offset: PAGE_SIZE,
        arrowData: { data: UNICODE },
      })
    )
    const { result } = renderLoader(client)

    result.current.getCellContent([0, 2])
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))

    // The stale response must not populate the cache; the cell stays loading.
    await waitFor(() => {
      expect(result.current.getCellContent([0, 2]).kind).toBe(
        GridCellKind.Loading
      )
    })
  })
})
