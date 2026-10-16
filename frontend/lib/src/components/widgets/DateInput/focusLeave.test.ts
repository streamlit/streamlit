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

import type { RefObject } from "react"

import { act, fireEvent, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  handlePassivePreviewFieldTab,
  isConcreteOutsideLeave,
  isFocusInsideWidget,
  usePopoverInteractionFlag,
} from "./focusLeave"

const flushRaf = (): Promise<void> =>
  act(
    async () =>
      new Promise<void>(resolve => {
        requestAnimationFrame(() => {
          resolve()
        })
      })
  )

describe("focusLeave helpers", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("classifies relatedTarget and focus containment", () => {
    const popover = document.createElement("div")
    const cell = document.createElement("button")
    popover.appendChild(cell)
    const outside = document.createElement("button")
    document.body.appendChild(outside)
    const portal = document.createElement("div")
    portal.className = "stDateInputHeaderPickerPopover"
    const item = document.createElement("button")
    portal.appendChild(item)
    document.body.appendChild(portal)
    expect(isConcreteOutsideLeave(null, { popover })).toBe(false)
    expect(isConcreteOutsideLeave(document.body, { popover })).toBe(true)
    expect(isConcreteOutsideLeave(outside, { popover })).toBe(true)
    expect(isConcreteOutsideLeave(cell, { popover })).toBe(false)
    expect(
      isConcreteOutsideLeave(item, {
        popover,
        excludeSelectors: [".stDateInputHeaderPickerPopover"],
      })
    ).toBe(false)
    const field = document.createElement("div")
    const segment = document.createElement("span")
    field.appendChild(segment)
    expect(isFocusInsideWidget(segment, { field, popover })).toBe(true)
    expect(isFocusInsideWidget(cell, { field, popover })).toBe(true)
    expect(isFocusInsideWidget(outside, { field, popover })).toBe(false)
  })

  it("handles passive preview Tab leave paths", async () => {
    const field = document.createElement("div")
    const first = document.createElement("span")
    first.setAttribute("data-type", "year")
    const last = document.createElement("span")
    last.setAttribute("data-type", "day")
    const button = document.createElement("button")
    const popover = document.createElement("div")
    const cell = document.createElement("div")
    cell.tabIndex = 0
    popover.appendChild(cell)
    field.append(first, last, button)
    document.body.append(field, popover)
    const leave = {
      immediate: vi.fn(),
      afterFocusSettles: vi.fn(),
      beforeFocusSettles: vi.fn(),
      focusStayedInside: vi.fn(),
    }
    const ctx = {
      field,
      calendarButton: button,
      popover,
      segmentSelector: '[data-type]:not([data-type="literal"])',
    }

    expect(
      handlePassivePreviewFieldTab(
        { key: "Tab", shiftKey: false, target: button },
        ctx,
        leave
      )
    ).toBe(true)
    expect(leave.immediate).toHaveBeenCalledOnce()
    leave.immediate.mockClear()
    expect(
      handlePassivePreviewFieldTab(
        { key: "Tab", shiftKey: true, target: first },
        ctx,
        leave
      )
    ).toBe(true)
    expect(leave.immediate).toHaveBeenCalledOnce()

    const outside = document.createElement("button")
    document.body.appendChild(outside)
    expect(
      handlePassivePreviewFieldTab(
        { key: "Tab", shiftKey: false, target: last },
        ctx,
        leave
      )
    ).toBe(true)
    expect(leave.beforeFocusSettles).toHaveBeenCalledOnce()
    outside.focus()
    await flushRaf()
    expect(leave.afterFocusSettles).toHaveBeenCalledOnce()

    // Toggle focus: stay open. Grid focus (Safari skip-button): park on toggle.
    leave.afterFocusSettles.mockClear()
    leave.focusStayedInside.mockClear()
    handlePassivePreviewFieldTab(
      { key: "Tab", shiftKey: false, target: last },
      ctx,
      leave
    )
    button.focus()
    await flushRaf()
    expect(leave.focusStayedInside).toHaveBeenCalledOnce()

    leave.focusStayedInside.mockClear()
    handlePassivePreviewFieldTab(
      { key: "Tab", shiftKey: false, target: last },
      ctx,
      leave
    )
    cell.focus()
    await flushRaf()
    expect(button).toHaveFocus()
    expect(leave.focusStayedInside).toHaveBeenCalledOnce()
    expect(leave.afterFocusSettles).not.toHaveBeenCalled()
  })

  it("tracks popover pointer phases, portals, text nodes, and teardown", () => {
    const popover = document.createElement("div")
    const cell = document.createElement("button")
    const dayNumber = document.createTextNode("20")
    cell.appendChild(dayNumber)
    popover.appendChild(cell)
    const portal = document.createElement("div")
    portal.className = "stDateInputHeaderPickerPopover"
    const item = document.createElement("button")
    portal.appendChild(item)
    document.body.append(popover, portal)
    const ref: RefObject<HTMLElement | null> = { current: popover }
    const { result, rerender, unmount } = renderHook(
      ({ isOpen }: { isOpen: boolean }) =>
        usePopoverInteractionFlag(isOpen, ref, [
          ".stDateInputHeaderPickerPopover",
        ]),
      { initialProps: { isOpen: true } }
    )
    const flag = result.current

    /* eslint-disable testing-library/prefer-user-event -- discrete pointer phases */
    expect(flag.current).toBe(false)
    fireEvent.pointerDown(cell)
    expect(flag.current).toBe(true)
    fireEvent.pointerUp(cell)
    expect(flag.current).toBe(true) // iOS: must survive pointerup
    fireEvent.click(cell)
    expect(flag.current).toBe(false)
    fireEvent.pointerDown(cell)
    fireEvent.pointerCancel(cell)
    expect(flag.current).toBe(false)
    fireEvent.pointerDown(item)
    expect(flag.current).toBe(true)
    fireEvent.click(item)
    fireEvent.pointerDown(dayNumber)
    expect(flag.current).toBe(true)
    fireEvent.pointerDown(cell)
    act(() => {
      rerender({ isOpen: false })
    })
    expect(flag.current).toBe(false)
    act(() => {
      rerender({ isOpen: true })
    })
    act(() => {
      unmount()
    })
    fireEvent.pointerDown(cell)
    /* eslint-enable testing-library/prefer-user-event */
    expect(flag.current).toBe(false)
  })
})
