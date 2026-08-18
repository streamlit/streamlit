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

import {
  KeyboardEvent,
  PointerEvent,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { streamlit } from "@streamlit/protobuf"

import { useRequiredContext } from "~lib/hooks/useRequiredContext"

import {
  KEYBOARD_RESIZE_STEP_PX,
  ResizableColumnsContext,
  RowMetrics,
} from "./ResizableColumnsContext"
import { StyledColumnResizeHandle } from "./styled-components"

/** Direction each supported arrow key moves the boundary in. */
const ARROW_KEY_DIRECTIONS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
}

interface DragGesture {
  /** Pointer position the drag started at. */
  startClientX: number
  /** Row geometry measured when the drag started. */
  row: RowMetrics
  /** Column widths the drag started from. */
  baseFractions: number[]
}

interface ColumnResizeHandleProps {
  /** Index of the column this handle sits on the right edge of. */
  index: number
  /** The column's gap, so the handle can be centered on the boundary. */
  gap: streamlit.IGapConfig | undefined
}

/**
 * A draggable boundary between two adjacent resizable columns.
 *
 * Implements the ARIA window splitter pattern: it is focusable, exposes the left
 * column's share of the pair as `aria-valuenow`, and supports the arrow keys as
 * a keyboard equivalent of dragging (plus `Enter` to reset, mirroring
 * double-click).
 */
const ColumnResizeHandle = ({
  index,
  gap,
}: ColumnResizeHandleProps): ReactElement => {
  const { columnFractions, measureRow, resizeColumns, resetColumns } =
    useRequiredContext(ResizableColumnsContext)

  const [isDragging, setIsDragging] = useState(false)
  const gestureRef = useRef<DragGesture | null>(null)
  const pendingClientXRef = useRef(0)
  /** Set while a move is waiting for its animation frame. */
  const hasPendingMoveRef = useRef(false)
  const frameRef = useRef<number | null>(null)

  /** Resizes to wherever the pointer was last seen. */
  const applyPendingMove = useCallback(() => {
    const gesture = gestureRef.current
    if (!gesture) {
      return
    }
    resizeColumns({
      index,
      deltaPx: pendingClientXRef.current - gesture.startClientX,
      row: gesture.row,
      baseFractions: gesture.baseFractions,
    })
  }, [index, resizeColumns])

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      // Stop the browser from starting a text selection or a native drag.
      event.preventDefault()

      const row = measureRow()
      if (row.width <= 0) {
        return
      }

      pendingClientXRef.current = event.clientX
      gestureRef.current = {
        startClientX: event.clientX,
        row,
        baseFractions: columnFractions,
      }
      // Capturing the pointer routes all later move/up events to this handle
      // even once the pointer leaves it, so no window listeners are needed and
      // touch drags work the same as mouse drags.
      event.currentTarget.setPointerCapture(event.pointerId)
      setIsDragging(true)
    },
    [columnFractions, measureRow]
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!gestureRef.current) {
        return
      }

      // Coalesce moves into at most one width update per frame.
      pendingClientXRef.current = event.clientX
      if (hasPendingMoveRef.current) {
        return
      }
      hasPendingMoveRef.current = true
      frameRef.current = requestAnimationFrame(() => {
        hasPendingMoveRef.current = false
        frameRef.current = null
        applyPendingMove()
      })
    },
    [applyPendingMove]
  )

  const handlePointerEnd = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!gestureRef.current) {
        return
      }

      if (hasPendingMoveRef.current) {
        // The pointer was released before the last move made it to the screen.
        // Apply it now so the columns end up where the user let go, instead of
        // wherever the previous frame happened to land.
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current)
        }
        hasPendingMoveRef.current = false
        frameRef.current = null
        applyPendingMove()
      }

      gestureRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
      setIsDragging(false)
    },
    [applyPendingMove]
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter") {
        event.preventDefault()
        resetColumns()
        return
      }

      const direction = ARROW_KEY_DIRECTIONS[event.key]
      if (direction === undefined) {
        return
      }
      event.preventDefault()

      const row = measureRow()
      if (row.width <= 0) {
        return
      }
      resizeColumns({
        index,
        deltaPx: direction * KEYBOARD_RESIZE_STEP_PX,
        row,
        baseFractions: columnFractions,
      })
    },
    [columnFractions, index, measureRow, resetColumns, resizeColumns]
  )

  useEffect(() => {
    if (!isDragging) {
      return undefined
    }

    // Keep the resize cursor and suppress text selection for the whole gesture,
    // no matter which element the pointer happens to be over.
    const { style } = document.body
    const previousCursor = style.cursor
    const previousUserSelect = style.userSelect
    style.cursor = "col-resize"
    style.userSelect = "none"

    return () => {
      style.cursor = previousCursor
      style.userSelect = previousUserSelect
    }
  }, [isDragging])

  // Screen readers announce how the pair of columns the handle sits between is
  // split, which is the only part of the row a drag can change.
  const leftFraction = columnFractions[index] ?? 0
  const pairFraction = leftFraction + (columnFractions[index + 1] ?? 0)
  const leftColumnShare =
    pairFraction > 0 ? Math.round((leftFraction / pairFraction) * 100) : 0

  return (
    <StyledColumnResizeHandle
      gap={gap}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize columns ${index + 1} and ${index + 2}`}
      aria-valuenow={leftColumnShare}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      data-dragging={isDragging ? "true" : undefined}
      data-testid="stColumnResizeHandle"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onDoubleClick={resetColumns}
      onKeyDown={handleKeyDown}
    />
  )
}

export default ColumnResizeHandle
