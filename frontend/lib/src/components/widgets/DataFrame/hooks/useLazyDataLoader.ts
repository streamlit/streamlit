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
  DataEditorProps,
  DataEditorRef,
  GridCell,
} from "@glideapps/glide-data-grid"
import { getLogger } from "loglevel"

import { ILazyDataframe, ISortState } from "@streamlit/protobuf"

import { BackendOperationClient } from "~lib/BackendOperationClient"
import { getCellFromArrow } from "~lib/components/widgets/DataFrame/arrowUtils"
import {
  BaseColumn,
  getErrorCell,
  getLoadingCell,
} from "~lib/components/widgets/DataFrame/columns"
import { LazyDataframeCache } from "~lib/components/widgets/DataFrame/LazyDataframeCache"
import { Quiver } from "~lib/dataframes/Quiver"

const LOG = getLogger("useLazyDataLoader")

type LazyDataLoaderReturn = {
  /** Glide-compatible cell content getter. */
  getCellContent: DataEditorProps["getCellContent"]
  /** Set the current sort state for server-side sorting. */
  setSort: (sort: ISortState | null) => void
  /** Get the current sort state. */
  getSort: () => ISortState | null
  /** Whether the cache is still loading initial data. */
  isLoading: boolean
}

interface UseLazyDataLoaderParams {
  /** Lazy dataframe metadata from the proto. */
  lazyData: ILazyDataframe
  /** Column definitions for the dataframe. */
  columns: BaseColumn[]
  /** Total number of rows (from lazyData.rowCount). */
  numRows: number
  /** Backend operation client for making chunk requests. */
  client: BackendOperationClient
  /** Reference to the DataEditor for triggering cell updates. */
  dataEditorRef: React.RefObject<DataEditorRef | null>
}

/**
 * Hook for loading dataframe data lazily from the backend.
 *
 * This hook provides a `getCellContent` function that returns loading cells
 * for rows that haven't been fetched yet, and triggers background fetches
 * to load the data.
 *
 * @param params - Configuration for lazy data loading
 * @returns Object containing getCellContent and sort control functions
 */
function useLazyDataLoader({
  lazyData,
  columns,
  numRows,
  client,
  dataEditorRef,
}: UseLazyDataLoaderParams): LazyDataLoaderReturn {
  // Track version to trigger re-renders when cache updates
  const [cacheVersion, setCacheVersion] = useState(0)

  // Track if we're still in initial loading state
  const [isLoading, setIsLoading] = useState(true)

  // Create cache instance with stable identity based on source/generation
  const cacheRef = useRef<LazyDataframeCache | null>(null)

  // Initialize cache with new source/generation
  const cache = useMemo(() => {
    const sourceId = lazyData.sourceId ?? ""
    const generation = lazyData.generation ?? ""
    const pageSize = lazyData.pageSize ?? 500
    const rowCount = Number(lazyData.rowCount ?? 0)

    LOG.debug(
      `Creating lazy cache for source ${sourceId}, generation ${generation}, ${rowCount} rows`
    )

    const newCache = new LazyDataframeCache({
      sourceId,
      generation,
      rowCount,
      pageSize,
      client,
      onUpdate: () => {
        // Increment cache version to trigger Glide Data Grid re-render.
        // The version change causes getCellContent to be called with fresh data.
        setCacheVersion(v => v + 1)
      },
    })

    cacheRef.current = newCache
    return newCache
    // Re-create cache when source identity changes
  }, [
    lazyData.sourceId,
    lazyData.generation,
    lazyData.pageSize,
    lazyData.rowCount,
    client,
    dataEditorRef,
  ])

  // Load initial chunk from proto if available
  useEffect(() => {
    if (lazyData.initialChunk?.data) {
      try {
        const initialQuiver = new Quiver(lazyData.initialChunk)
        const initialOffset = Number(lazyData.initialOffset ?? 0)
        cache.loadInitialChunk(initialQuiver, initialOffset)
        setIsLoading(false)
        LOG.debug(`Loaded initial chunk at offset ${initialOffset}`)
      } catch (error) {
        LOG.error("Failed to load initial chunk:", error)
        setIsLoading(false)
      }
    } else {
      setIsLoading(false)
    }
  }, [cache, lazyData.initialChunk, lazyData.initialOffset])

  const getCellContent = useCallback(
    ([col, row]: readonly [number, number]): GridCell => {
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

      const column = columns[col]
      const originalCol = column.indexNumber

      // Try to get data from cache
      const rowData = cache.getRowData(row)

      if (!rowData) {
        // Data not loaded yet - trigger fetch and return loading cell
        void cache.ensureRowLoaded(row)
        // Also prefetch ahead for smoother scrolling
        cache.prefetch(row, 1)
        return getLoadingCell()
      }

      try {
        const { quiver, localRow } = rowData
        const arrowCell = quiver.getCell(localRow, originalCol)

        return getCellFromArrow(
          column,
          arrowCell,
          undefined, // No styled cell support for lazy loading
          undefined // No CSS styles
        )
      } catch (error) {
        return getErrorCell(
          "Error during cell creation",
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Error loading cell: ${error}`
        )
      }
    },
    // cacheVersion is intentionally included to trigger re-render when cache updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, numRows, cache, cacheVersion]
  )

  const setSort = useCallback(
    (sort: ISortState | null) => {
      cache.setSort(sort)
      // Clear the loading cell state since we'll re-fetch with new sort
      setCacheVersion(v => v + 1)
    },
    [cache]
  )

  const getSort = useCallback(() => cache.getSort(), [cache])

  return {
    getCellContent,
    setSort,
    getSort,
    isLoading,
  }
}

export default useLazyDataLoader
