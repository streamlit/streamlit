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

import { beforeEach, describe, expect, it, Mock, vi } from "vitest"

import { ISortState, SortState } from "@streamlit/protobuf"

import type { BackendOperationClient } from "~lib/BackendOperationClient"
import { Quiver } from "~lib/dataframes/Quiver"

import { LazyDataframeCache } from "./LazyDataframeCache"

vi.mock("~lib/dataframes/Quiver", () => {
  // The cache constructs `new Quiver(arrowData)` and only reads
  // `dimensions.numDataRows` for logging, so a lightweight stub is enough.
  class MockQuiver {
    public readonly arrowData: unknown
    public readonly dimensions = { numDataRows: 1 }
    public constructor(arrowData: unknown) {
      this.arrowData = arrowData
    }
  }
  return { Quiver: MockQuiver }
})

/** Flush all pending microtasks and timers. */
const flushPromises = (): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, 0))

/** Build a successful chunk response with arbitrary (mocked) Arrow bytes. */
const chunkResponse = (): { arrowData: { data: Uint8Array } } => ({
  arrowData: { data: new Uint8Array([1, 2, 3]) },
})

const DESCENDING: ISortState = {
  column: "colA",
  direction: SortState.SortDirection.DESCENDING,
}

describe("LazyDataframeCache", () => {
  let requestDataframeChunk: Mock
  let client: BackendOperationClient
  let onUpdate: Mock

  const createCache = (
    overrides: Partial<{
      rowCount: number
      pageSize: number
    }> = {}
  ): LazyDataframeCache => {
    return new LazyDataframeCache({
      sourceId: "source-1",
      generation: "gen-1",
      rowCount: overrides.rowCount ?? 1000,
      pageSize: overrides.pageSize ?? 100,
      client,
      onUpdate,
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    requestDataframeChunk = vi.fn().mockResolvedValue(chunkResponse())
    onUpdate = vi.fn()
    client = {
      requestDataframeChunk,
    } as unknown as BackendOperationClient
  })

  describe("getChunkOffset", () => {
    it("aligns row indices down to the page boundary", () => {
      const cache = createCache({ pageSize: 100 })
      expect(cache.getChunkOffset(0)).toBe(0)
      expect(cache.getChunkOffset(99)).toBe(0)
      expect(cache.getChunkOffset(100)).toBe(100)
      expect(cache.getChunkOffset(250)).toBe(200)
    })
  })

  describe("loadInitialChunk", () => {
    it("makes the initial chunk available synchronously without a request", () => {
      const cache = createCache({ pageSize: 100 })
      const quiver = new Quiver({ data: new Uint8Array() })
      cache.loadInitialChunk(quiver, 0)

      const rowData = cache.getRowData(5)
      expect(rowData).not.toBeNull()
      expect(rowData?.quiver).toBe(quiver)
      expect(rowData?.localRow).toBe(5)
      expect(requestDataframeChunk).not.toHaveBeenCalled()
    })
  })

  describe("getRowData", () => {
    it("returns null for rows that have not been loaded", () => {
      const cache = createCache()
      expect(cache.getRowData(42)).toBeNull()
    })

    it("returns data with the correct local row offset after a fetch", async () => {
      const cache = createCache({ pageSize: 100 })
      await cache.ensureRowLoaded(150)
      await flushPromises()

      const rowData = cache.getRowData(150)
      expect(rowData).not.toBeNull()
      // Row 150 lives in the chunk starting at offset 100 -> localRow 50.
      expect(rowData?.localRow).toBe(50)
    })
  })

  describe("ensureRowLoaded", () => {
    it("requests the chunk containing the row with the correct offset/limit", async () => {
      const cache = createCache({ pageSize: 100 })
      await cache.ensureRowLoaded(250)

      expect(requestDataframeChunk).toHaveBeenCalledTimes(1)
      expect(requestDataframeChunk).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceId: "source-1",
          generation: "gen-1",
          offset: 200,
          limit: 100,
        })
      )
    })

    it("deduplicates concurrent requests for the same chunk", async () => {
      const cache = createCache({ pageSize: 100 })
      await Promise.all([cache.ensureRowLoaded(10), cache.ensureRowLoaded(20)])

      // Both rows are in the same chunk (offset 0) -> a single request.
      expect(requestDataframeChunk).toHaveBeenCalledTimes(1)
    })

    it("does not re-request a chunk that is already loaded", async () => {
      const cache = createCache({ pageSize: 100 })
      await cache.ensureRowLoaded(10)
      await flushPromises()
      await cache.ensureRowLoaded(10)

      expect(requestDataframeChunk).toHaveBeenCalledTimes(1)
    })

    it("invokes onUpdate after a chunk finishes loading", async () => {
      const cache = createCache({ pageSize: 100 })
      await cache.ensureRowLoaded(10)
      await flushPromises()

      expect(onUpdate).toHaveBeenCalled()
    })
  })

  describe("sort handling", () => {
    it("includes the current sort in chunk requests", async () => {
      const cache = createCache({ pageSize: 100 })
      cache.setSort(DESCENDING)
      await cache.ensureRowLoaded(0)

      expect(requestDataframeChunk).toHaveBeenCalledWith(
        expect.objectContaining({ sort: DESCENDING })
      )
    })

    it("keeps separate cache entries per sort state", async () => {
      const cache = createCache({ pageSize: 100 })

      await cache.ensureRowLoaded(0)
      await flushPromises()
      expect(cache.getRowData(0)).not.toBeNull()

      // Switching sort invalidates the visible data (different cache bucket).
      cache.setSort(DESCENDING)
      expect(cache.getRowData(0)).toBeNull()

      await cache.ensureRowLoaded(0)
      await flushPromises()
      // A separate request was made for the sorted bucket.
      expect(requestDataframeChunk).toHaveBeenCalledTimes(2)
      expect(cache.getRowData(0)).not.toBeNull()

      // Switching back reuses the previously cached unsorted chunk.
      cache.setSort(null)
      expect(cache.getRowData(0)).not.toBeNull()
    })
  })

  describe("error handling and retry cap", () => {
    it("retries a failing chunk up to the cap, then surfaces the error and stops", async () => {
      requestDataframeChunk.mockRejectedValue(new Error("boom"))
      const cache = createCache({ pageSize: 100 })

      // Drive repeated load attempts the way the grid does on each render.
      for (let i = 0; i < 6; i++) {
        await cache.ensureRowLoaded(0).catch(() => {})
        await flushPromises()
      }

      // The chunk is retried at most MAX_CHUNK_RETRIES (3) times total.
      expect(requestDataframeChunk).toHaveBeenCalledTimes(3)
      // The terminal error is surfaced for the row.
      expect(cache.getRowError(0)).toBe("boom")
      // Row data remains unavailable.
      expect(cache.getRowData(0)).toBeNull()
    })

    it("does not report an error while a chunk is still pending or loaded", async () => {
      const cache = createCache({ pageSize: 100 })
      // Pending (request not yet resolved).
      void cache.ensureRowLoaded(0).catch(() => {})
      expect(cache.getRowError(0)).toBeNull()

      await flushPromises()
      // Loaded successfully.
      expect(cache.getRowError(0)).toBeNull()
    })
  })

  describe("clear", () => {
    it("drops all cached chunks", async () => {
      const cache = createCache({ pageSize: 100 })
      await cache.ensureRowLoaded(0)
      await flushPromises()
      expect(cache.getRowData(0)).not.toBeNull()

      cache.clear()
      expect(cache.getRowData(0)).toBeNull()
    })
  })
})
