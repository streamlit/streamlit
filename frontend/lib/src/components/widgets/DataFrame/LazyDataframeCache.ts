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

import { getLogger } from "loglevel"

import {
  IDataframeChunkResponsePayload,
  ISortState,
  SortState,
} from "@streamlit/protobuf"

import type { BackendOperationClient } from "~lib/BackendOperationClient"
import { Quiver } from "~lib/dataframes/Quiver"

const LOG = getLogger("LazyDataframeCache")

/** Status of a chunk in the cache. */
type ChunkStatus = "pending" | "loaded" | "error"

/** A cached chunk of dataframe data. */
interface CachedChunk {
  /** The Quiver object containing the parsed Arrow data. */
  quiver: Quiver | null
  /** Current status of the chunk. */
  status: ChunkStatus
  /** Promise that resolves when the chunk is loaded. */
  promise: Promise<Quiver> | null
  /** Error message if the chunk failed to load. */
  errorMsg?: string
}

/** Configuration for the lazy dataframe cache. */
export interface LazyDataframeCacheConfig {
  /** The source ID for this lazy dataframe. */
  sourceId: string
  /** The generation identifier for cache invalidation. */
  generation: string
  /** The total number of rows in the dataframe. */
  rowCount: number
  /** The page size for chunk requests. */
  pageSize: number
  /** The backend operation client for making chunk requests. */
  client: BackendOperationClient
  /** Optional callback when cache state changes (for triggering re-renders). */
  onUpdate?: () => void
}

/**
 * Key for identifying cached chunks based on sort state.
 * Different sort states require separate cache entries.
 */
function makeSortKey(sort: ISortState | null | undefined): string {
  if (!sort?.column) {
    return "unsorted"
  }
  const dir =
    sort.direction === SortState.SortDirection.DESCENDING ? "desc" : "asc"
  return `${sort.column}:${dir}`
}

/**
 * Cache for lazy dataframe chunks.
 *
 * This class manages the fetching and caching of dataframe chunks for lazy loading.
 * It handles:
 * - Chunk-based pagination with configurable page size
 * - Server-side sorting (sort state changes invalidate the cache)
 * - Concurrent request deduplication
 * - Generation-based cache invalidation
 */
export class LazyDataframeCache {
  private readonly sourceId: string

  private readonly generation: string

  private readonly rowCount: number

  private readonly pageSize: number

  private readonly client: BackendOperationClient

  private readonly onUpdate?: () => void

  /** Nested map: sortKey -> offset -> CachedChunk */
  private readonly cache = new Map<string, Map<number, CachedChunk>>()

  /** Current sort state for requests. */
  private currentSort: ISortState | null = null

  public constructor(config: LazyDataframeCacheConfig) {
    this.sourceId = config.sourceId
    this.generation = config.generation
    this.rowCount = config.rowCount
    this.pageSize = config.pageSize
    this.client = config.client
    this.onUpdate = config.onUpdate
  }

  /**
   * Load the initial chunk from the proto (already fetched by the backend).
   */
  public loadInitialChunk(quiver: Quiver, offset: number): void {
    const sortKey = makeSortKey(null)
    const sortCache = this.ensureSortCache(sortKey)
    sortCache.set(offset, {
      quiver,
      status: "loaded",
      promise: Promise.resolve(quiver),
    })
    LOG.debug(`Loaded initial chunk at offset ${offset}`)
  }

  /**
   * Set the current sort state. This will be used for subsequent chunk requests.
   * Note: Changing sort state does not invalidate existing cache entries for other
   * sort states - they remain available if the user changes back.
   */
  public setSort(sort: ISortState | null): void {
    this.currentSort = sort
  }

  /**
   * Get the current sort state.
   */
  public getSort(): ISortState | null {
    return this.currentSort
  }

  /**
   * Check if a row is loaded for the current sort state.
   */
  public isRowLoaded(rowIndex: number): boolean {
    const chunk = this.getChunkForRow(rowIndex, this.currentSort)
    return chunk?.status === "loaded" && chunk.quiver !== null
  }

  /**
   * Get the Quiver data for a specific row, or null if not loaded.
   * This is a synchronous operation - it returns immediately with cached data
   * or null if the data isn't available yet.
   */
  public getRowData(
    rowIndex: number
  ): { quiver: Quiver; localRow: number } | null {
    const chunkOffset = this.getChunkOffset(rowIndex)
    const chunk = this.getChunkForRow(rowIndex, this.currentSort)

    if (chunk?.status !== "loaded" || !chunk.quiver) {
      return null
    }

    return {
      quiver: chunk.quiver,
      localRow: rowIndex - chunkOffset,
    }
  }

  /**
   * Ensure a chunk is loaded for the given row index.
   * If the chunk is not in cache, it will be fetched from the backend.
   * Returns a promise that resolves when the chunk is available.
   */
  public ensureRowLoaded(rowIndex: number): Promise<Quiver> {
    const chunkOffset = this.getChunkOffset(rowIndex)
    return this.ensureChunkLoaded(chunkOffset, this.currentSort)
  }

  /**
   * Prefetch chunks around a given row index for smoother scrolling.
   * This loads the current chunk plus adjacent chunks.
   */
  public prefetch(rowIndex: number, numChunksAhead: number = 1): void {
    const baseOffset = this.getChunkOffset(rowIndex)

    // Prefetch current chunk and chunks ahead
    for (let i = 0; i <= numChunksAhead; i++) {
      const offset = baseOffset + i * this.pageSize
      if (offset < this.rowCount) {
        void this.ensureChunkLoaded(offset, this.currentSort)
      }
    }
  }

  /**
   * Get the chunk offset for a given row index.
   */
  public getChunkOffset(rowIndex: number): number {
    return Math.floor(rowIndex / this.pageSize) * this.pageSize
  }

  /**
   * Clear the cache for all sort states.
   */
  public clear(): void {
    this.cache.clear()
    LOG.debug("Cleared all chunks")
  }

  /**
   * Get cache statistics for debugging.
   */
  public getStats(): {
    totalChunks: number
    loadedChunks: number
    pendingChunks: number
    sortStates: number
  } {
    let totalChunks = 0
    let loadedChunks = 0
    let pendingChunks = 0

    for (const sortCache of this.cache.values()) {
      for (const chunk of sortCache.values()) {
        totalChunks++
        if (chunk.status === "loaded") loadedChunks++
        if (chunk.status === "pending") pendingChunks++
      }
    }

    return {
      totalChunks,
      loadedChunks,
      pendingChunks,
      sortStates: this.cache.size,
    }
  }

  private ensureSortCache(sortKey: string): Map<number, CachedChunk> {
    if (!this.cache.has(sortKey)) {
      this.cache.set(sortKey, new Map())
    }
    return this.cache.get(sortKey) ?? new Map()
  }

  private getChunkForRow(
    rowIndex: number,
    sort: ISortState | null
  ): CachedChunk | undefined {
    const sortKey = makeSortKey(sort)
    const offset = this.getChunkOffset(rowIndex)
    return this.cache.get(sortKey)?.get(offset)
  }

  private ensureChunkLoaded(
    offset: number,
    sort: ISortState | null
  ): Promise<Quiver> {
    const sortKey = makeSortKey(sort)
    const sortCache = this.ensureSortCache(sortKey)

    const existingChunk = sortCache.get(offset)
    if (existingChunk) {
      if (existingChunk.status === "loaded" && existingChunk.quiver) {
        return Promise.resolve(existingChunk.quiver)
      }
      if (existingChunk.promise) {
        return existingChunk.promise
      }
      if (existingChunk.status === "error") {
        // Retry failed chunks
        LOG.debug(`Retrying failed chunk at offset ${offset}`)
      }
    }

    // Start fetching the chunk
    const promise = this.fetchChunk(offset, sort)

    sortCache.set(offset, {
      quiver: null,
      status: "pending",
      promise,
    })

    promise
      .then(quiver => {
        sortCache.set(offset, {
          quiver,
          status: "loaded",
          promise: null,
        })
        this.onUpdate?.()
      })
      .catch((error: Error) => {
        LOG.error(`Failed to load chunk at offset ${offset}:`, error)
        sortCache.set(offset, {
          quiver: null,
          status: "error",
          promise: null,
          errorMsg: error.message,
        })
        this.onUpdate?.()
      })

    return promise
  }

  private async fetchChunk(
    offset: number,
    sort: ISortState | null
  ): Promise<Quiver> {
    LOG.debug(
      `Fetching chunk at offset ${offset} with sort ${makeSortKey(sort)}`
    )

    const response: IDataframeChunkResponsePayload =
      await this.client.requestDataframeChunk({
        sourceId: this.sourceId,
        offset,
        limit: this.pageSize,
        generation: this.generation,
        sort: sort ?? undefined,
      })

    if (!response.arrowData?.data) {
      throw new Error("Response contained no Arrow data")
    }

    const quiver = new Quiver(response.arrowData)
    LOG.debug(
      `Loaded chunk at offset ${offset}: ${quiver.dimensions.numDataRows} rows`
    )
    return quiver
  }
}
