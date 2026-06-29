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

import { Quiver } from "~lib/dataframes/Quiver"

/**
 * Maximum number of loaded chunks to retain. Older chunks are evicted in
 * insertion order (FIFO) once this limit is exceeded. This bounds browser
 * memory for very large lazy dataframes.
 */
const DEFAULT_MAX_CHUNKS = 50

/**
 * A simple FIFO-evicting cache of row chunks for a lazy dataframe. Each chunk is
 * a parsed {@link Quiver} covering a contiguous range of `chunkSize` rows.
 *
 * The cache is a plain (non-reactive) data structure owned by the lazy data
 * loader hook. Render updates are driven by a separate cache-version state in
 * the hook, not by this object.
 */
export class LazyDataframeCache {
  private readonly chunks = new Map<number, Quiver>()

  private readonly failedChunks = new Map<number, string>()

  public constructor(
    private readonly chunkSize: number,
    private readonly maxChunks: number = DEFAULT_MAX_CHUNKS
  ) {}

  /** The number of rows per chunk (the backend page size). */
  public get pageSize(): number {
    return this.chunkSize
  }

  /** Map a row index to its chunk index. */
  public getChunkIndex(row: number): number {
    return Math.floor(row / this.chunkSize)
  }

  /** Return the loaded chunk for the given chunk index, if present. */
  public getChunk(chunkIndex: number): Quiver | undefined {
    return this.chunks.get(chunkIndex)
  }

  /** Whether a loaded (non-failed) chunk exists for the given index. */
  public hasChunk(chunkIndex: number): boolean {
    return this.chunks.has(chunkIndex)
  }

  /** Return the error message for a failed chunk, if any. */
  public getFailure(chunkIndex: number): string | undefined {
    return this.failedChunks.get(chunkIndex)
  }

  /** Store a loaded chunk, evicting the oldest chunk if over capacity. */
  public addChunk(chunkIndex: number, chunk: Quiver): void {
    this.failedChunks.delete(chunkIndex)
    this.chunks.set(chunkIndex, chunk)

    if (this.chunks.size > this.maxChunks) {
      const oldestKey = this.chunks.keys().next().value
      if (oldestKey !== undefined) {
        this.chunks.delete(oldestKey)
      }
    }
  }

  /** Record that loading a chunk failed. */
  public setFailed(chunkIndex: number, message: string): void {
    this.failedChunks.set(chunkIndex, message)

    // Bound the failed-chunk map the same way as loaded chunks so a pathological
    // failure pattern can't grow it without limit.
    if (this.failedChunks.size > this.maxChunks) {
      const oldestKey = this.failedChunks.keys().next().value
      if (oldestKey !== undefined) {
        this.failedChunks.delete(oldestKey)
      }
    }
  }

  /** Clear a failed chunk so it can be retried. */
  public clearFailure(chunkIndex: number): void {
    this.failedChunks.delete(chunkIndex)
  }

  /** Remove all loaded and failed chunks (e.g. on sort or generation change). */
  public clear(): void {
    this.chunks.clear()
    this.failedChunks.clear()
  }
}
