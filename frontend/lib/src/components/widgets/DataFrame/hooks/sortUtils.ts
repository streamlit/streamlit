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

import { BaseColumn } from "~lib/components/widgets/DataFrame/columns"

/**
 * The active column sort, identified by the frontend column id and direction.
 * Used by both the client (eager) and server (lazy) sorting modes.
 */
export interface ActiveColumnSort {
  columnId: string
  direction: "asc" | "desc"
}

/**
 * Resolve the next column sort state when a column is sorted.
 *
 * - ``"auto"`` toggles the clicked column through ascending → descending →
 *   no sort.
 * - An explicit ``"asc"``/``"desc"`` direction is applied directly.
 * - ``autoReset`` clears the sort when the requested direction matches the
 *   active direction (used by the column menu's explicit sort actions).
 *
 * @returns the next sort state, or ``undefined`` to clear sorting.
 */
export function getNextColumnSort(
  current: ActiveColumnSort | undefined,
  columnId: string,
  direction?: "asc" | "desc" | "auto",
  autoReset?: boolean
): ActiveColumnSort | undefined {
  let nextDirection: "asc" | "desc" | undefined
  if (direction === "auto") {
    // Toggle ascending → descending → none on repeated clicks.
    nextDirection = "asc"
    if (current?.columnId === columnId) {
      nextDirection = current.direction === "asc" ? "desc" : undefined
    }
  } else {
    nextDirection = direction
  }

  if (nextDirection === undefined) {
    return undefined
  }
  if (autoReset && nextDirection === current?.direction) {
    return undefined
  }
  return { columnId, direction: nextDirection }
}

/**
 * Decorate the active column's title with a sort-direction indicator
 * (↑ for ascending, ↓ for descending). Other columns are returned unchanged.
 */
export function applySortIndicator(
  columns: BaseColumn[],
  sort: ActiveColumnSort | undefined
): BaseColumn[] {
  if (sort === undefined) {
    return columns
  }
  return columns.map(column =>
    column.id === sort.columnId
      ? {
          ...column,
          title:
            sort.direction === "asc"
              ? `↑ ${column.title}`
              : `↓ ${column.title}`,
        }
      : column
  )
}
