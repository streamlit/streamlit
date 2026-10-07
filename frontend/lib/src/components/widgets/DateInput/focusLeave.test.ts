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
import { afterEach, describe, expect, it } from "vitest"

import {
  isConcreteOutsideLeave,
  isFocusInsideWidget,
  usePopoverInteractionFlag,
} from "./focusLeave"

describe("isConcreteOutsideLeave", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("treats null as not a leave", () => {
    expect(
      isConcreteOutsideLeave(null, { popover: document.createElement("div") })
    ).toBe(false)
  })

  it("treats document.body as a leave once popover interaction is ruled out", () => {
    expect(
      isConcreteOutsideLeave(document.body, {
        popover: document.createElement("div"),
      })
    ).toBe(true)
  })

  it("treats targets inside the popover as not a leave", () => {
    const popover = document.createElement("div")
    const cell = document.createElement("button")
    popover.appendChild(cell)
    expect(isConcreteOutsideLeave(cell, { popover })).toBe(false)
  })

  it("treats targets in excluded portals as not a leave", () => {
    const portal = document.createElement("div")
    portal.className = "stDateInputHeaderPickerPopover"
    const item = document.createElement("button")
    portal.appendChild(item)
    document.body.appendChild(portal)
    expect(
      isConcreteOutsideLeave(item, {
        popover: document.createElement("div"),
        excludeSelectors: [".stDateInputHeaderPickerPopover"],
      })
    ).toBe(false)
  })

  it("treats a concrete outside element as a leave", () => {
    const outside = document.createElement("button")
    document.body.appendChild(outside)
    expect(
      isConcreteOutsideLeave(outside, {
        popover: document.createElement("div"),
      })
    ).toBe(true)
  })
})

describe("isFocusInsideWidget", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("detects focus in the field or popover", () => {
    const field = document.createElement("div")
    const popover = document.createElement("div")
    const segment = document.createElement("span")
    const cell = document.createElement("button")
    field.appendChild(segment)
    popover.appendChild(cell)
    expect(isFocusInsideWidget(segment, { field, popover })).toBe(true)
    expect(isFocusInsideWidget(cell, { field, popover })).toBe(true)
    expect(
      isFocusInsideWidget(document.createElement("button"), { field, popover })
    ).toBe(false)
  })
})

describe("usePopoverInteractionFlag", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  const mountFlag = (
    popover: HTMLElement,
    excludeSelectors: readonly string[] = []
  ): {
    flag: RefObject<boolean>
    rerender: (isOpen: boolean) => void
    unmount: () => void
  } => {
    const popoverRef: RefObject<HTMLElement | null> = { current: popover }
    document.body.appendChild(popover)

    const { result, rerender, unmount } = renderHook(
      ({ isOpen }: { isOpen: boolean }) =>
        usePopoverInteractionFlag(isOpen, popoverRef, excludeSelectors),
      { initialProps: { isOpen: true } }
    )

    return {
      flag: result.current,
      rerender: (isOpen: boolean) => {
        rerender({ isOpen })
      },
      unmount,
    }
  }

  it("keeps the flag through pointerup until click (iOS-safe order)", () => {
    const popover = document.createElement("div")
    const cell = document.createElement("button")
    popover.appendChild(cell)
    const { flag } = mountFlag(popover)

    expect(flag.current).toBe(false)

    fireEvent.pointerDown(cell)
    expect(flag.current).toBe(true)

    // iOS fires pointerup before the blur this flag must still guard.
    fireEvent.pointerUp(cell)
    expect(flag.current).toBe(true)

    fireEvent.click(cell)
    expect(flag.current).toBe(false)
  })

  it("clears on pointercancel", () => {
    const popover = document.createElement("div")
    const cell = document.createElement("button")
    popover.appendChild(cell)
    const { flag } = mountFlag(popover)

    fireEvent.pointerDown(cell)
    expect(flag.current).toBe(true)

    fireEvent.pointerCancel(cell)
    expect(flag.current).toBe(false)
  })

  it("sets the flag for excluded portal pointerdown", () => {
    const popover = document.createElement("div")
    const portal = document.createElement("div")
    portal.className = "stDateInputHeaderPickerPopover"
    const item = document.createElement("button")
    portal.appendChild(item)
    document.body.appendChild(portal)
    const { flag } = mountFlag(popover, [".stDateInputHeaderPickerPopover"])

    fireEvent.pointerDown(item)
    expect(flag.current).toBe(true)
  })

  it("clears when the popover closes", () => {
    const popover = document.createElement("div")
    const cell = document.createElement("button")
    popover.appendChild(cell)
    const { flag, rerender } = mountFlag(popover)

    fireEvent.pointerDown(cell)
    expect(flag.current).toBe(true)

    act(() => {
      rerender(false)
    })
    expect(flag.current).toBe(false)
  })

  it("stops listening after unmount", () => {
    const popover = document.createElement("div")
    const cell = document.createElement("button")
    popover.appendChild(cell)
    const { flag, unmount } = mountFlag(popover)

    act(() => {
      unmount()
    })

    fireEvent.pointerDown(cell)
    expect(flag.current).toBe(false)
  })
})
