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

import { describe, expect, it } from "vitest"

import { Quiver } from "~lib/dataframes/Quiver"

import { LazyDataframeCache } from "./LazyDataframeCache"

// A minimal stand-in for a parsed Quiver chunk. The cache treats chunks as
// opaque values, so a cast is sufficient for these tests.
const makeChunk = (id: number): Quiver => ({ id }) as unknown as Quiver

describe("LazyDataframeCache", () => {
  it("maps row indices to chunk indices using the page size", () => {
    const cache = new LazyDataframeCache(500)
    expect(cache.getChunkIndex(0)).toBe(0)
    expect(cache.getChunkIndex(499)).toBe(0)
    expect(cache.getChunkIndex(500)).toBe(1)
    expect(cache.getChunkIndex(1250)).toBe(2)
  })

  it("stores and retrieves chunks", () => {
    const cache = new LazyDataframeCache(500)
    const chunk = makeChunk(1)
    expect(cache.hasChunk(0)).toBe(false)

    cache.addChunk(0, chunk)
    expect(cache.hasChunk(0)).toBe(true)
    expect(cache.getChunk(0)).toBe(chunk)
    expect(cache.getChunk(1)).toBeUndefined()
  })

  it("tracks and clears failed chunks", () => {
    const cache = new LazyDataframeCache(500)
    cache.setFailed(2, "boom")
    expect(cache.getFailure(2)).toBe("boom")
    expect(cache.hasChunk(2)).toBe(false)

    cache.clearFailure(2)
    expect(cache.getFailure(2)).toBeUndefined()
  })

  it("clears a failure when the chunk is later loaded", () => {
    const cache = new LazyDataframeCache(500)
    cache.setFailed(3, "temporary error")
    cache.addChunk(3, makeChunk(3))
    expect(cache.getFailure(3)).toBeUndefined()
    expect(cache.hasChunk(3)).toBe(true)
  })

  it("evicts the oldest chunk when exceeding the max-chunks limit", () => {
    const maxChunks = 3
    const cache = new LazyDataframeCache(500, maxChunks)
    cache.addChunk(0, makeChunk(0))
    cache.addChunk(1, makeChunk(1))
    cache.addChunk(2, makeChunk(2))
    cache.addChunk(3, makeChunk(3))

    // The oldest chunk (index 0) should have been evicted.
    expect(cache.hasChunk(0)).toBe(false)
    expect(cache.hasChunk(1)).toBe(true)
    expect(cache.hasChunk(3)).toBe(true)
  })

  it("evicts the oldest failed chunk when exceeding the max-chunks limit", () => {
    const maxChunks = 3
    const cache = new LazyDataframeCache(500, maxChunks)
    cache.setFailed(0, "err-0")
    cache.setFailed(1, "err-1")
    cache.setFailed(2, "err-2")
    cache.setFailed(3, "err-3")

    // The oldest failure (index 0) should have been evicted.
    expect(cache.getFailure(0)).toBeUndefined()
    expect(cache.getFailure(1)).toBe("err-1")
    expect(cache.getFailure(3)).toBe("err-3")
  })

  it("clears all loaded and failed chunks", () => {
    const cache = new LazyDataframeCache(500)
    cache.addChunk(0, makeChunk(0))
    cache.setFailed(1, "err")

    cache.clear()
    expect(cache.hasChunk(0)).toBe(false)
    expect(cache.getFailure(1)).toBeUndefined()
  })

  it("exposes the page size", () => {
    const cache = new LazyDataframeCache(250)
    expect(cache.pageSize).toBe(250)
  })
})
