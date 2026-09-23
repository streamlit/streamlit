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

import { PointerEvent, useCallback, useEffect, useRef, useState } from "react"

import { useWindowDimensionsContext } from "~lib/components/shared/WindowDimensions/useWindowDimensionsContext"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { convertRemToPx } from "~lib/theme/utils"

import { type ModalPosition } from "./styled-components"

export interface UseDrawerResizeArgs {
  position: ModalPosition
  /** CSS width from the size/width presets. Used until the user drags. */
  presetWidth: string | undefined
}

interface DrawerResizeHandleProps {
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void
  onDoubleClick: () => void
}

export interface UseDrawerResizeResult {
  /** Preset width, or a pixel width after the user has dragged. */
  dialogWidth: string | undefined
  /** Inner-edge side to grow from, or `null` for a centered dialog. */
  resizeSide: "left" | "right" | null
  resizeHandleProps: DrawerResizeHandleProps
}

/**
 * Clamp a side-drawer width between the theme minimum and a max width.
 * On viewports narrower than the minimum, the max wins so a strip of the
 * app stays visible.
 */
export function clampDrawerWidth(
  widthPx: number,
  minWidthPx: number,
  maxWidthPx: number
): number {
  const minWidth = Math.min(minWidthPx, maxWidthPx)
  return Math.min(maxWidthPx, Math.max(minWidth, widthPx))
}

/**
 * Horizontal resize for left/right dialog drawers. Width is remembered only
 * while the dialog stays mounted; double-click restores the preset.
 */
export function useDrawerResize({
  position,
  presetWidth,
}: UseDrawerResizeArgs): UseDrawerResizeResult {
  const { sizes, spacing } = useEmotionTheme()
  const { innerWidth } = useWindowDimensionsContext()
  const [resizedWidthPx, setResizedWidthPx] = useState<number | undefined>(
    undefined
  )
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const minDrawerWidthPx = convertRemToPx(sizes.minPopupWidth)
  const drawerGutterPx = convertRemToPx(spacing.twoXL)
  const resizeSide = position === "center" ? null : position
  const dialogWidth =
    resizedWidthPx === undefined ? presetWidth : `${resizedWidthPx}px`

  useEffect(() => {
    return () => {
      document.body.style.userSelect = ""
    }
  }, [])

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>): void => {
      if (event.button !== 0) {
        return
      }
      const panel = event.currentTarget.parentElement
      if (!panel) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture?.(event.pointerId)
      document.body.style.userSelect = "none"
      dragRef.current = {
        startX: event.clientX,
        // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Need the painted width to start from rem/calc presets.
        startWidth: panel.getBoundingClientRect().width,
      }
    },
    []
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>): void => {
      const drag = dragRef.current
      if (!drag) {
        return
      }
      const deltaX = event.clientX - drag.startX
      const nextWidth =
        position === "left"
          ? drag.startWidth + deltaX
          : drag.startWidth - deltaX
      const viewportWidthPx = innerWidth > 0 ? innerWidth : minDrawerWidthPx
      const maxDrawerWidthPx = Math.max(0, viewportWidthPx - drawerGutterPx)
      setResizedWidthPx(
        clampDrawerWidth(nextWidth, minDrawerWidthPx, maxDrawerWidthPx)
      )
    },
    [drawerGutterPx, innerWidth, minDrawerWidthPx, position]
  )

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>): void => {
      if (dragRef.current === null) {
        return
      }
      dragRef.current = null
      document.body.style.userSelect = ""
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    },
    []
  )

  const handleDoubleClick = useCallback((): void => {
    setResizedWidthPx(undefined)
  }, [])

  return {
    dialogWidth,
    resizeSide,
    resizeHandleProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onDoubleClick: handleDoubleClick,
    },
  }
}
