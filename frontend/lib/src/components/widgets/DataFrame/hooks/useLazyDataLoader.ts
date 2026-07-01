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

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  GridCell,
  GridCellKind,
  type Item,
  LoadingCell,
  type Rectangle,
} from "@glideapps/glide-data-grid"

import { SortState } from "@streamlit/protobuf"

import { BackendOperationClient } from "~lib/BackendOperationClient"
import { getCellFromArrow } from "~lib/components/widgets/DataFrame/arrowUtils"
import {
  BaseColumn,
  getErrorCell,
} from "~lib/components/widgets/DataFrame/columns"
import { ServerSortState } from "~lib/components/widgets/DataFrame/hooks/useColumnSort"
import { LazyDataframeCache } from "~lib/components/widgets/DataFrame/LazyDataframeCache"
import { Quiver } from "~lib/dataframes/Quiver"
import { useDebouncedCallback } from "~lib/hooks/useDebouncedCallback"

/** Debounce window for chunk requests during rapid scrolling. */
const CHUNK_REQUEST_DEBOUNCE_MS = 150

/** Number of extra chunks to prefetch before and after the visible range. */
const PREFETCH_BUFFER_CHUNKS = 1

const LOADING_CELL: LoadingCell = {
  kind: GridCellKind.Loading,
  allowOverlay: false,
  skeletonWidth: 60,
  skeletonHeight: 16,
  skeletonWidthVariability: 25,
}

interface UseLazyDataLoaderParams {
  /** The initial chunk (chunk index 0) parsed from the proto, with full schema. */
  initialChunk: Quiver
  /** The columns of the table (used to extract cell values from chunk data). */
  columns: BaseColumn[]
  /** The total number of rows in the source. */
  numRows: number
  /** The session-scoped source id. */
  sourceId: string
  /** The source generation token (stale responses are ignored). */
  generation: string
  /** The number of rows the backend serves per chunk. */
  pageSize: number
  /** The active server-side sort state, or undefined. */
  sortState: ServerSortState | undefined
  /** Client used to request chunks without a script rerun. */
  backendOperationClient: BackendOperationClient | undefined
}

interface UseLazyDataLoaderReturn {
  /** Synchronous cell getter for glide-data-grid. */
  getCellContent: (cell: Item) => GridCell
  /** Handler to wire to glide's onVisibleRegionChanged for prefetching. */
  onVisibleRegionChanged: (range: Rectangle) => void
}

/** Per-source/sort controller bundling the cache and in-flight tracking. */
interface LazyLoaderController {
  cache: LazyDataframeCache
  inFlight: Set<number>
}

/**
 * Loads dataframe rows lazily in fixed-size chunks from the backend.
 *
 * Glide's `getCellContent` must stay synchronous, so this hook returns parsed
 * cells for loaded rows, native loading cells for rows whose chunk is still in
 * flight, and error cells for ranges that failed to load. Chunk requests are
 * debounced during rapid scrolling and deduplicated. A cache-version state is
 * bumped whenever a chunk arrives so the grid re-renders the affected cells.
 *
 * Changing the source (id/generation), page size, or sort state creates a
 * fresh cache; in-flight responses for a previous cache are written to a
 * discarded cache and therefore ignored.
 */
function useLazyDataLoader({
  initialChunk,
  columns,
  numRows,
  sourceId,
  generation,
  pageSize,
  sortState,
  backendOperationClient,
}: UseLazyDataLoaderParams): UseLazyDataLoaderReturn {
  // Bumped whenever a chunk arrives. It is included in the `getCellContent`
  // dependency list so the returned cell getter changes identity on every
  // chunk load, which is what makes glide-data-grid repaint the affected cells
  // (glide caches cells and won't redraw if `getCellContent` keeps the same
  // reference). Without this, asynchronously loaded rows can stay stuck as
  // loading skeletons until an unrelated scroll/sort forces a refresh.
  const [cacheVersion, setCacheVersion] = useState(0)
  const bumpCacheVersion = useCallback(
    () => setCacheVersion(version => version + 1),
    []
  )

  // Guard against a non-positive page size (e.g. an unset proto field that
  // defaults to 0). A zero page size would send `limit: 0` requests and break
  // the row-to-chunk offset math, so every consumer below uses this clamped
  // value (the cache applies the same guard internally as defense in depth).
  const effectivePageSize = Math.max(1, pageSize)

  const sortKey = sortState
    ? `${sortState.column}:${sortState.descending ? "desc" : "asc"}`
    : ""

  // A fresh controller (cache + in-flight set) is created whenever the source,
  // page size, or sort changes. The initial chunk seeds chunk 0 only when there
  // is no active sort (a sorted chunk 0 has different rows).
  const controller = useMemo<LazyLoaderController>(() => {
    const cache = new LazyDataframeCache(effectivePageSize)
    if (sortKey === "") {
      cache.addChunk(0, initialChunk)
    }
    return { cache, inFlight: new Set<number>() }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sortKey captures sortState
  }, [sourceId, generation, effectivePageSize, sortKey, initialChunk])

  const requestChunk = useCallback(
    (chunkIndex: number): void => {
      const { cache, inFlight } = controller
      if (
        chunkIndex < 0 ||
        cache.hasChunk(chunkIndex) ||
        cache.getFailure(chunkIndex) !== undefined ||
        inFlight.has(chunkIndex)
      ) {
        return
      }

      if (!backendOperationClient) {
        cache.setFailed(
          chunkIndex,
          "No active connection is available to load more rows."
        )
        bumpCacheVersion()
        return
      }

      inFlight.add(chunkIndex)
      const offset = chunkIndex * effectivePageSize
      const sortPayload = sortState
        ? {
            column: sortState.column,
            direction: sortState.descending
              ? SortState.SortDirection.DESCENDING
              : SortState.SortDirection.ASCENDING,
          }
        : undefined

      backendOperationClient
        .requestDataframeChunk({
          sourceId,
          offset,
          limit: effectivePageSize,
          generation,
          sort: sortPayload,
        })
        .then(response => {
          inFlight.delete(chunkIndex)
          // Ignore responses for a different source or stale generation.
          if (
            response.sourceId !== sourceId ||
            response.generation !== generation
          ) {
            return
          }
          if (!response.arrowData?.data) {
            cache.setFailed(
              chunkIndex,
              "Received an empty chunk from the server."
            )
          } else {
            cache.addChunk(chunkIndex, new Quiver(response.arrowData))
          }
          bumpCacheVersion()
        })
        .catch((error: unknown) => {
          inFlight.delete(chunkIndex)
          cache.setFailed(
            chunkIndex,
            error instanceof Error ? error.message : String(error)
          )
          bumpCacheVersion()
        })
    },
    [
      controller,
      backendOperationClient,
      effectivePageSize,
      sourceId,
      generation,
      sortState,
      bumpCacheVersion,
    ]
  )

  // Debounce the actual network requests so rapid scrolling doesn't fire a
  // request for every chunk the user scrolls past.
  const pendingRef = useRef<Set<number>>(new Set())
  const { debouncedCallback: flushPendingRequests } = useDebouncedCallback(
    () => {
      const indices = Array.from(pendingRef.current)
      pendingRef.current.clear()
      indices.forEach(requestChunk)
    },
    CHUNK_REQUEST_DEBOUNCE_MS
  )

  const scheduleRequest = useCallback(
    (chunkIndex: number): void => {
      pendingRef.current.add(chunkIndex)
      flushPendingRequests()
    },
    [flushPendingRequests]
  )

  // Drop debounced chunk indices queued for a previous controller when the
  // source, page size, or sort changes, so stale indices can't spill into the
  // new request cycle (they would target a different cache/sort).
  useEffect(() => {
    pendingRef.current.clear()
  }, [sourceId, generation, effectivePageSize, sortKey])

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      if (col > columns.length - 1) {
        return getErrorCell(
          "Column index out of bounds",
          "This error should never happen. Please report this bug."
        )
      }
      if (row > numRows - 1) {
        return getErrorCell(
          "Row index out of bounds",
          "This error should never happen. Please report this bug."
        )
      }

      const { cache } = controller
      const chunkIndex = cache.getChunkIndex(row)
      const chunk = cache.getChunk(chunkIndex)

      if (chunk !== undefined) {
        try {
          const column = columns[col]
          const localRow = row - chunkIndex * effectivePageSize
          const arrowCell = chunk.getCell(localRow, column.indexNumber)
          return getCellFromArrow(column, arrowCell, undefined)
        } catch (error) {
          return getErrorCell(
            "Error during cell creation",
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `This error should never happen. Please report this bug. \nError: ${error}`
          )
        }
      }

      const failure = cache.getFailure(chunkIndex)
      if (failure !== undefined) {
        return getErrorCell("Failed to load data", failure)
      }

      // The chunk isn't loaded yet: schedule a request and show a loading cell.
      scheduleRequest(chunkIndex)
      return LOADING_CELL
    },
    // `cacheVersion` is not read in the body; it is intentionally included so
    // this getter changes identity whenever a chunk arrives, prompting
    // glide-data-grid to repaint.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cacheVersion is an intentional repaint signal
    [
      columns,
      numRows,
      controller,
      effectivePageSize,
      scheduleRequest,
      cacheVersion,
    ]
  )

  const onVisibleRegionChanged = useCallback(
    (range: Rectangle): void => {
      const { cache } = controller
      if (numRows <= 0) {
        return
      }
      const lastRow = Math.min(range.y + range.height - 1, numRows - 1)
      // The highest chunk index that can contain rows. Prefetching past this
      // would request a chunk that can never exist (e.g. when numRows is an
      // exact multiple of pageSize) and cache a bogus "empty chunk" failure.
      const maxChunk = cache.getChunkIndex(numRows - 1)
      const firstChunk = Math.max(
        0,
        cache.getChunkIndex(range.y) - PREFETCH_BUFFER_CHUNKS
      )
      const lastChunk = Math.min(
        cache.getChunkIndex(lastRow) + PREFETCH_BUFFER_CHUNKS,
        maxChunk
      )
      for (
        let chunkIndex = firstChunk;
        chunkIndex <= lastChunk;
        chunkIndex++
      ) {
        if (cache.hasChunk(chunkIndex)) {
          continue
        }
        // Retry a previously failed chunk when it is scrolled back into view:
        // the failure may have been transient (e.g. a timeout or a brief
        // connection drop). Clearing it here lets `requestChunk` issue a fresh
        // request. This retry is user-driven and debounced/deduplicated, so it
        // can't turn into a retry storm.
        if (cache.getFailure(chunkIndex) !== undefined) {
          cache.clearFailure(chunkIndex)
        }
        scheduleRequest(chunkIndex)
      }
    },
    [controller, numRows, scheduleRequest]
  )

  return useMemo(
    () => ({ getCellContent, onVisibleRegionChanged }),
    [getCellContent, onVisibleRegionChanged]
  )
}

export default useLazyDataLoader
