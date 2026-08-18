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

import { ReactElement, useContext, useRef } from "react"

import { act, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { Block as BlockProto } from "@streamlit/protobuf"

import { BlockNode } from "~lib/AppNode"
import { renderWithContexts } from "~lib/test_util"

import {
  MIN_COLUMN_WIDTH_PX,
  ResizableColumnsContext,
  ResizableColumnsProvider,
  resizeColumnFractions,
} from "./ResizableColumnsContext"

const FAKE_SCRIPT_HASH = "fake_script_hash"

/** Row width all drags in these tests are measured against. */
const ROW_WIDTH = 800

/** Pixel drag that moves a boundary by exactly 10% of ROW_WIDTH. */
const DRAG_PX = 80

describe("resizeColumnFractions", () => {
  it("moves the boundary between the two adjacent columns only", () => {
    const baseFractions = [0.25, 0.25, 0.5]

    const result = resizeColumnFractions({
      index: 0,
      deltaPx: DRAG_PX,
      row: { width: ROW_WIDTH, gapPx: 0 },
      baseFractions,
    })

    expect(result[0]).toBe(0.35)
    expect(result[1]).toBe(0.15)
    // The column that is not part of the dragged pair must not move at all.
    expect(result[2]).toBe(baseFractions[2])
  })

  it("preserves the combined width of the dragged pair", () => {
    const baseFractions = [0.25, 0.25, 0.5]

    const result = resizeColumnFractions({
      index: 1,
      deltaPx: -DRAG_PX,
      row: { width: ROW_WIDTH, gapPx: 0 },
      baseFractions,
    })

    expect(result[1] + result[2]).toBeCloseTo(
      baseFractions[1] + baseFractions[2],
      4
    )
  })

  it.each([
    ["right", 10_000],
    ["left", -10_000],
  ])(
    "clamps at the minimum column width when dragged far %s",
    (_direction, deltaPx) => {
      const result = resizeColumnFractions({
        index: 0,
        deltaPx,
        row: { width: ROW_WIDTH, gapPx: 0 },
        baseFractions: [0.5, 0.5],
      })

      // Fractions are stored to 4 decimals, so the clamp lands within a
      // rounding step of the minimum rather than exactly on it.
      const minFraction = MIN_COLUMN_WIDTH_PX / ROW_WIDTH
      expect(Math.min(result[0], result[1])).toBeCloseTo(minFraction, 3)
      expect(result[0] + result[1]).toBeLessThanOrEqual(1)
    }
  )

  it.each([
    [
      "the row width cannot be measured",
      { row: { width: 0, gapPx: 0 }, deltaPx: DRAG_PX },
    ],
    [
      "the drag does not move anything",
      { row: { width: ROW_WIDTH, gapPx: 0 }, deltaPx: 0 },
    ],
  ])("returns the base fractions unchanged when %s", (_reason, params) => {
    const baseFractions = [0.5, 0.5]

    expect(resizeColumnFractions({ index: 0, baseFractions, ...params })).toBe(
      baseFractions
    )
  })

  it("leaves the pair alone when it cannot fit two minimum widths", () => {
    // Both columns together are narrower than 2 * 64px, so honoring the minimum
    // width for one would push the other below it.
    const baseFractions = [0.1, 0.1, 0.8]

    expect(
      resizeColumnFractions({
        index: 0,
        deltaPx: DRAG_PX,
        row: { width: 500, gapPx: 0 },
        baseFractions,
      })
    ).toBe(baseFractions)
  })

  it("keeps the fractions adding up to one so the row cannot wrap", () => {
    // Thirds are the worst case for rounding. If both sides of the pair were
    // rounded up, the flex bases would total slightly over 100% and a zero-gap
    // row would push its last column onto a second line.
    const baseFractions = [1 / 3, 1 / 3, 1 / 3]

    for (const deltaPx of [1, 7, 13, 29, 61, -1, -7, -13, -29, -61]) {
      const result = resizeColumnFractions({
        index: 0,
        deltaPx,
        row: { width: ROW_WIDTH, gapPx: 0 },
        baseFractions,
      })

      expect(
        result.reduce((total, fraction) => total + fraction, 0)
      ).toBeLessThanOrEqual(1)
    }
  })

  it("keeps a clamped column visible when the gap is wider than the minimum", () => {
    // `StyledColumn` lays a column out as `calc(fraction * 100% - gap)`, so at
    // large gaps a fraction that ignores the gap resolves to a negative width.
    const gapPx = 128
    const result = resizeColumnFractions({
      index: 0,
      deltaPx: -10_000,
      row: { width: ROW_WIDTH, gapPx },
      baseFractions: [1 / 3, 1 / 3, 1 / 3],
    })

    const laidOutWidth = result[0] * ROW_WIDTH - gapPx
    expect(laidOutWidth).toBeGreaterThan(0)
    // The column's share of the row's leftover gap space brings it back up to
    // exactly the minimum width.
    expect(laidOutWidth + gapPx / 3).toBeCloseTo(MIN_COLUMN_WIDTH_PX, 4)
  })

  it("ignores an index without a column to its right", () => {
    const baseFractions = [0.5, 0.5]

    expect(
      resizeColumnFractions({
        index: 1,
        deltaPx: DRAG_PX,
        row: { width: ROW_WIDTH, gapPx: 0 },
        baseFractions,
      })
    ).toBe(baseFractions)
  })
})

function makeColumn(weight: number): BlockNode {
  return new BlockNode(
    FAKE_SCRIPT_HASH,
    [],
    new BlockProto({ allowEmpty: true, column: { weight } })
  )
}

/** Renders the context values so tests can assert on them as text. */
const ContextProbe = ({ index }: { index: number }): ReactElement => {
  const value = useContext(ResizableColumnsContext)

  if (!value) {
    return <div data-testid="resizingDisabled" />
  }

  const { columnFractions, columnIndexes, measureRow, resizeColumns } = value
  return (
    <div>
      <span data-testid="columnFractions">{columnFractions.join(" ")}</span>
      <span data-testid="columnIndexes">
        {[...columnIndexes.values()].join(" ")}
      </span>
      <button
        onClick={() =>
          resizeColumns({
            index,
            deltaPx: DRAG_PX,
            row: measureRow(),
            baseFractions: columnFractions,
          })
        }
      >
        drag
      </button>
      <button onClick={value.resetColumns}>reset</button>
    </div>
  )
}

interface HarnessProps {
  /** Column weights, recreated as new nodes on every render like a rerun does. */
  weights: number[]
  wrap?: boolean
  index?: number
}

const Harness = ({
  weights,
  wrap = true,
  index = 0,
}: HarnessProps): ReactElement => {
  const rowRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={rowRef} data-testid="row">
      <ResizableColumnsProvider
        columnNodes={weights.map(weight => makeColumn(weight))}
        wrap={wrap}
        containerRef={rowRef}
      >
        <ContextProbe index={index} />
      </ResizableColumnsProvider>
    </div>
  )
}

function renderHarness(props: HarnessProps): {
  rerenderHarness: (nextProps: HarnessProps) => void
} {
  const { rerender } = renderWithContexts(<Harness {...props} />)

  const row = screen.queryByTestId("row")
  if (row) {
    // jsdom reports a zero-size rect for every element, so the row has to be
    // given a width for the pixel-to-fraction conversion to do anything.
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue({
      width: ROW_WIDTH,
    } as DOMRect)
  }

  return {
    rerenderHarness: nextProps => rerender(<Harness {...nextProps} />),
  }
}

function setViewportWidth(innerWidth: number): void {
  Object.defineProperty(window, "innerWidth", {
    value: innerWidth,
    writable: true,
    configurable: true,
  })
}

describe("ResizableColumnsProvider", () => {
  afterEach(() => {
    setViewportWidth(1024)
  })

  it("exposes the spec proportions and the column order by default", () => {
    renderHarness({ weights: [0.5, 0.5] })

    expect(screen.getByTestId("columnFractions")).toHaveTextContent("0.5 0.5")
    expect(screen.getByTestId("columnIndexes")).toHaveTextContent("0 1")
  })

  it("applies a drag to the adjacent pair", async () => {
    const user = userEvent.setup()
    renderHarness({ weights: [0.5, 0.5] })

    await user.click(screen.getByRole("button", { name: "drag" }))

    expect(screen.getByTestId("columnFractions")).toHaveTextContent("0.6 0.4")
  })

  it("restores the spec proportions when reset", async () => {
    const user = userEvent.setup()
    renderHarness({ weights: [0.5, 0.5] })

    await user.click(screen.getByRole("button", { name: "drag" }))
    await user.click(screen.getByRole("button", { name: "reset" }))

    expect(screen.getByTestId("columnFractions")).toHaveTextContent("0.5 0.5")
  })

  it("keeps the dragged widths across a rerun with the same columns", async () => {
    const user = userEvent.setup()
    const { rerenderHarness } = renderHarness({ weights: [0.5, 0.5] })
    await user.click(screen.getByRole("button", { name: "drag" }))

    rerenderHarness({ weights: [0.5, 0.5] })

    expect(screen.getByTestId("columnFractions")).toHaveTextContent("0.6 0.4")
  })

  it.each([
    ["the spec changes", [0.7, 0.3], "0.7 0.3"],
    ["the column count changes", [0.5, 0.25, 0.25], "0.5 0.25 0.25"],
  ])(
    "resets the dragged widths when %s",
    async (_reason, nextWeights, expected) => {
      const user = userEvent.setup()
      const { rerenderHarness } = renderHarness({ weights: [0.5, 0.5] })
      await user.click(screen.getByRole("button", { name: "drag" }))

      rerenderHarness({ weights: nextWeights })

      expect(screen.getByTestId("columnFractions")).toHaveTextContent(expected)
    }
  )

  it("stops offering resizing while the columns are stacked", () => {
    setViewportWidth(400)

    renderHarness({ weights: [0.5, 0.5] })

    expect(screen.getByTestId("resizingDisabled")).toBeVisible()
    expect(screen.queryByTestId("columnFractions")).not.toBeInTheDocument()
  })

  it("keeps offering resizing on narrow viewports when the row cannot wrap", () => {
    setViewportWidth(400)

    renderHarness({ weights: [0.5, 0.5], wrap: false })

    expect(screen.getByTestId("columnFractions")).toHaveTextContent("0.5 0.5")
    expect(screen.queryByTestId("resizingDisabled")).not.toBeInTheDocument()
  })

  it("keeps the dragged widths across a stack and unstack round trip", async () => {
    const user = userEvent.setup()
    renderHarness({ weights: [0.5, 0.5] })
    await user.click(screen.getByRole("button", { name: "drag" }))

    act(() => {
      setViewportWidth(400)
      window.dispatchEvent(new Event("resize"))
    })
    expect(screen.getByTestId("resizingDisabled")).toBeVisible()

    act(() => {
      setViewportWidth(1024)
      window.dispatchEvent(new Event("resize"))
    })

    await waitFor(() =>
      expect(screen.getByTestId("columnFractions")).toHaveTextContent(
        "0.6 0.4"
      )
    )
  })
})
