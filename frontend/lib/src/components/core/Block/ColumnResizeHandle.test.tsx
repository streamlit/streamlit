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

import { fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { streamlit } from "@streamlit/protobuf"

import { renderWithContexts } from "~lib/test_util"

import ColumnResizeHandle from "./ColumnResizeHandle"
import {
  KEYBOARD_RESIZE_STEP_PX,
  MIN_COLUMN_WIDTH_PX,
  ResizableColumnsContext,
  ResizableColumnsContextValue,
  RowMetrics,
} from "./ResizableColumnsContext"

const ROW_WIDTH = 800

const DRAG_START_X = 100

const DRAG_END_X = 160

/** The id `userEvent` gives the mouse pointer. */
const MOUSE_POINTER_ID = 1

const ROW: RowMetrics = {
  width: ROW_WIDTH,
  gapPx: 0,
  minColumnWidthPx: MIN_COLUMN_WIDTH_PX,
}

function renderHandle(
  overrides: Partial<ResizableColumnsContextValue> = {},
  showBorder = false
): ResizableColumnsContextValue & { unmount: () => void } {
  const contextValue: ResizableColumnsContextValue = {
    columnIndexes: new Map(),
    columnFractions: [0.5, 0.5],
    measureRow: () => ROW,
    resizeColumns: vi.fn(),
    resetColumns: vi.fn(),
    ...overrides,
  }

  const { unmount } = renderWithContexts(
    <ResizableColumnsContext.Provider value={contextValue}>
      <ColumnResizeHandle
        index={0}
        gap={{ gapSize: streamlit.GapSize.SMALL }}
        showBorder={showBorder}
      />
    </ResizableColumnsContext.Provider>
  )

  return { ...contextValue, unmount }
}

/**
 * Cancels the gesture that `pointerId` started.
 *
 * `userEvent` cannot cancel a gesture, and jsdom has no `PointerEvent`, so
 * `fireEvent` drops the `pointerId` the handle matches against.
 */
function cancelPointer(element: HTMLElement, pointerId: number): void {
  const event = new Event("pointercancel", { bubbles: true })
  Object.defineProperty(event, "pointerId", { value: pointerId })
  fireEvent(element, event)
}

function getHandle(): HTMLElement {
  return screen.getByRole("separator", { name: "Resize columns 1 and 2" })
}

async function dragHandle(): Promise<void> {
  const user = userEvent.setup()
  const handle = getHandle()

  await user.pointer([
    {
      keys: "[MouseLeft>]",
      target: handle,
      coords: { clientX: DRAG_START_X },
    },
    { target: handle, coords: { clientX: DRAG_END_X } },
    { keys: "[/MouseLeft]", target: handle, coords: { clientX: DRAG_END_X } },
  ])
}

describe("ColumnResizeHandle", () => {
  beforeEach(() => {
    // Flush the drag's coalesced update synchronously so assertions don't have
    // to await a real animation frame.
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      callback(0)
      return 0
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
    // The Pointer Capture stubs live on Element.prototype (see vitest.setup.ts),
    // so their call counts are shared by every test in this file.
    vi.mocked(Element.prototype.setPointerCapture).mockClear()
    vi.mocked(Element.prototype.releasePointerCapture).mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("exposes itself as a keyboard-reachable vertical splitter", () => {
    renderHandle({ columnFractions: [0.75, 0.25] })

    const handle = getHandle()
    // The indicator only fades in on hover/focus, so it starts out transparent.
    expect(handle).toHaveStyle("opacity: 0")
    expect(handle).toHaveStyle("cursor: col-resize")
    expect(handle).toHaveAttribute("aria-orientation", "vertical")
    expect(handle).toHaveAttribute("aria-valuemin", "0")
    expect(handle).toHaveAttribute("aria-valuemax", "100")
    // The left column takes 75% of the pair the handle sits between.
    expect(handle).toHaveAttribute("aria-valuenow", "75")
    expect(handle).toHaveAttribute("aria-valuetext", "75% / 25%")
    expect(handle).toHaveAttribute("tabindex", "0")
  })

  it.each([
    // Half a gap (0.5rem) plus half the handle's own width (0.25rem).
    ["without a border", false, "calc((1rem + 0.5rem) / -2 - 0px)"],
    // A border insets the padding box the handle is positioned against, so the
    // offset has to grow by the border's width to stay on the boundary.
    ["with a border", true, "calc((1rem + 0.5rem) / -2 - 1px)"],
  ])(
    "centers itself on the column boundary %s",
    (_name, showBorder, right) => {
      renderHandle({}, showBorder)

      expect(getHandle()).toHaveStyle(`right: ${right}`)
    }
  )

  it("resizes by the distance dragged and releases the pointer afterwards", async () => {
    const { resizeColumns } = renderHandle()

    await dragHandle()

    expect(resizeColumns).toHaveBeenCalledTimes(1)
    expect(resizeColumns).toHaveBeenCalledWith({
      index: 0,
      deltaPx: DRAG_END_X - DRAG_START_X,
      row: ROW,
      baseFractions: [0.5, 0.5],
    })
    expect(Element.prototype.setPointerCapture).toHaveBeenCalled()
    expect(Element.prototype.releasePointerCapture).toHaveBeenCalled()
  })

  it("ignores a drag started with a secondary mouse button", async () => {
    const user = userEvent.setup()
    const { resizeColumns } = renderHandle()
    const handle = getHandle()

    await user.pointer([
      {
        keys: "[MouseRight>]",
        target: handle,
        coords: { clientX: DRAG_START_X },
      },
      { target: handle, coords: { clientX: DRAG_END_X } },
    ])

    expect(resizeColumns).not.toHaveBeenCalled()
    // Capturing the pointer would paint the resize cursor over the page for as
    // long as the context menu is open.
    expect(handle).not.toHaveAttribute("data-dragging")
    expect(Element.prototype.setPointerCapture).not.toHaveBeenCalled()
  })

  it("keeps a drag anchored to the finger that started it", async () => {
    const user = userEvent.setup()
    const { resizeColumns } = renderHandle()
    const handle = getHandle()

    await user.pointer([
      { keys: "[TouchA>]", target: handle, coords: { clientX: DRAG_START_X } },
      // A second contact lands on the handle too, but it must not drag the
      // boundary to its own position...
      {
        keys: "[TouchB>]",
        target: handle,
        coords: { clientX: DRAG_START_X + 200 },
      },
      {
        pointerName: "TouchB",
        target: handle,
        coords: { clientX: DRAG_START_X + 300 },
      },
      // ...and lifting it must not end a gesture the first finger still owns.
      {
        keys: "[/TouchB]",
        target: handle,
        coords: { clientX: DRAG_START_X + 300 },
      },
    ])

    expect(resizeColumns).not.toHaveBeenCalled()
    expect(handle).toHaveAttribute("data-dragging", "true")

    await user.pointer([
      {
        pointerName: "TouchA",
        target: handle,
        coords: { clientX: DRAG_END_X },
      },
      { keys: "[/TouchA]", target: handle, coords: { clientX: DRAG_END_X } },
    ])

    expect(resizeColumns).toHaveBeenCalledTimes(1)
    expect(resizeColumns).toHaveBeenCalledWith(
      expect.objectContaining({ deltaPx: DRAG_END_X - DRAG_START_X })
    )
    expect(handle).not.toHaveAttribute("data-dragging")
  })

  it("takes focus on pointer down so the arrow keys work after a drag", async () => {
    const { resizeColumns } = renderHandle()
    const handle = getHandle()
    expect(handle).not.toHaveFocus()

    await dragHandle()
    expect(handle).toHaveFocus()

    // Without the focus the handle would need a separate Tab before the arrow
    // keys reached it.
    await userEvent.keyboard("{ArrowRight}")
    expect(resizeColumns).toHaveBeenLastCalledWith(
      expect.objectContaining({ deltaPx: KEYBOARD_RESIZE_STEP_PX })
    )
  })

  it("cancels a queued resize when the handle unmounts mid-drag", async () => {
    const user = userEvent.setup()
    // Hold the coalesced update back so a move is still queued at unmount.
    vi.mocked(window.requestAnimationFrame).mockReturnValue(1)
    const { resizeColumns, unmount } = renderHandle()
    const handle = getHandle()
    await user.pointer([
      {
        keys: "[MouseLeft>]",
        target: handle,
        coords: { clientX: DRAG_START_X },
      },
      { target: handle, coords: { clientX: DRAG_END_X } },
    ])

    unmount()

    // The queued callback would otherwise resize a row that is gone, e.g. once
    // a narrowing viewport has stacked the columns.
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1)
    expect(resizeColumns).not.toHaveBeenCalled()
  })

  it("applies the last move even when the pointer is released before it paints", async () => {
    // Hold the coalesced update back so the release happens while a move is
    // still queued, which is what a quick flick of the pointer looks like.
    const queuedFrames: FrameRequestCallback[] = []
    vi.mocked(window.requestAnimationFrame).mockImplementation(callback => {
      queuedFrames.push(callback)
      return queuedFrames.length
    })
    const { resizeColumns } = renderHandle()

    await dragHandle()

    // Dropping the queued frame would leave the columns short of the pointer.
    expect(resizeColumns).toHaveBeenCalledTimes(1)
    expect(resizeColumns).toHaveBeenCalledWith(
      expect.objectContaining({ deltaPx: DRAG_END_X - DRAG_START_X })
    )
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
  })

  it("shows the drag indicator only while dragging", async () => {
    const user = userEvent.setup()
    renderHandle()
    const handle = getHandle()
    expect(handle).not.toHaveAttribute("data-dragging")

    await user.pointer({
      keys: "[MouseLeft>]",
      target: handle,
      coords: { clientX: DRAG_START_X },
    })
    // Touch devices never match :hover, so the indicator is kept up explicitly.
    expect(handle).toHaveAttribute("data-dragging", "true")
    expect(document.body).toHaveStyle("cursor: col-resize")

    await user.pointer({ keys: "[/MouseLeft]", target: handle })
    expect(handle).not.toHaveAttribute("data-dragging")
    expect(document.body).not.toHaveStyle("cursor: col-resize")
  })

  it("stops resizing when the gesture is cancelled", async () => {
    const user = userEvent.setup()
    const { resizeColumns } = renderHandle()
    const handle = getHandle()

    await user.pointer({
      keys: "[MouseLeft>]",
      target: handle,
      coords: { clientX: DRAG_START_X },
    })
    cancelPointer(handle, MOUSE_POINTER_ID)
    await user.pointer({ target: handle, coords: { clientX: DRAG_END_X } })

    expect(resizeColumns).not.toHaveBeenCalled()
    expect(handle).not.toHaveAttribute("data-dragging")
  })

  it("ignores pointer movement that is not part of a drag", async () => {
    const user = userEvent.setup()
    const { resizeColumns } = renderHandle()

    await user.pointer({
      target: getHandle(),
      coords: { clientX: DRAG_END_X },
    })

    expect(resizeColumns).not.toHaveBeenCalled()
  })

  it.each([
    ["{ArrowRight}", 10],
    ["{ArrowLeft}", -10],
  ])("resizes in 10px steps when %s is pressed", async (key, deltaPx) => {
    const user = userEvent.setup()
    const { resizeColumns } = renderHandle()
    getHandle().focus()

    await user.keyboard(key)

    expect(resizeColumns).toHaveBeenCalledWith({
      index: 0,
      deltaPx,
      row: ROW,
      baseFractions: [0.5, 0.5],
    })
  })

  it.each(["{ArrowUp}", "{ArrowDown}", "a"])(
    "does nothing when %s is pressed",
    async key => {
      const user = userEvent.setup()
      const { resizeColumns, resetColumns } = renderHandle()
      getHandle().focus()

      await user.keyboard(key)

      expect(resizeColumns).not.toHaveBeenCalled()
      expect(resetColumns).not.toHaveBeenCalled()
    }
  )

  it("resets all columns on double click", async () => {
    const user = userEvent.setup()
    const { resetColumns, resizeColumns } = renderHandle()

    await user.dblClick(getHandle())

    expect(resetColumns).toHaveBeenCalled()
    expect(resizeColumns).not.toHaveBeenCalled()
  })

  it("resets all columns when Enter is pressed", async () => {
    const user = userEvent.setup()
    const { resetColumns, resizeColumns } = renderHandle()
    getHandle().focus()

    await user.keyboard("{Enter}")

    expect(resetColumns).toHaveBeenCalled()
    expect(resizeColumns).not.toHaveBeenCalled()
  })

  it("does not resize when the row width cannot be measured", async () => {
    const user = userEvent.setup()
    const { resizeColumns } = renderHandle({
      measureRow: () => ({ ...ROW, width: 0 }),
    })
    const handle = getHandle()

    await dragHandle()
    handle.focus()
    await user.keyboard("{ArrowRight}")

    expect(resizeColumns).not.toHaveBeenCalled()
    expect(Element.prototype.setPointerCapture).not.toHaveBeenCalled()
  })
})
