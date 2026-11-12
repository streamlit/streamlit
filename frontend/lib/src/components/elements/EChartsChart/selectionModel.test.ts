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

import { describe, expect, it, type Mock, vi } from "vitest"

import {
  buildSelectionState,
  normalizeNativeSelection,
  parseOptionSpec,
  resolveSelectionOption,
  type SelectChangedParams,
  type SelectedEntry,
} from "./selectionModel"

const TOP_LEVEL_SERIES = [{ type: "bar", data: [1, 2] }]
const RESOLVED_OPTION = { series: [{ type: "line", id: "resolved" }] }

/** A chart stub whose ``getOption`` returns ``resolved`` (``RESOLVED_OPTION`` by default). */
function chartStub(resolved: unknown = RESOLVED_OPTION): {
  getOption: Mock<() => unknown>
} {
  return { getOption: vi.fn<() => unknown>(() => resolved) }
}

describe("parseOptionSpec", () => {
  it.each([
    ["an empty spec", ""],
    ["invalid JSON", "{not-valid-json"],
    ["a JSON array", "[1, 2]"],
    ["a JSON string", '"series"'],
    ["JSON null", "null"],
  ])("returns null for %s", (_label, spec) => {
    expect(parseOptionSpec(spec)).toBeNull()
  })

  it("returns the parsed object for a JSON object spec", () => {
    expect(parseOptionSpec('{"series": [{"type": "bar"}]}')).toEqual({
      series: [{ type: "bar" }],
    })
  })
})

describe("resolveSelectionOption", () => {
  it("uses the parsed spec when variants cannot override its series", () => {
    const parsed = {
      series: TOP_LEVEL_SERIES,
      media: [
        null,
        "not-an-object",
        { query: { maxWidth: 500 } },
        { option: { title: { text: "Narrow" } } },
      ],
      options: [null, { title: { text: "2015" } }],
    }
    const chart = chartStub()

    expect(resolveSelectionOption(parsed, chart)).toBe(parsed)
    expect(chart.getOption).not.toHaveBeenCalled()
  })

  it.each([
    [
      "media variants",
      { series: TOP_LEVEL_SERIES, media: [{ option: { series: [{}] } }] },
    ],
    [
      "timeline options",
      { series: TOP_LEVEL_SERIES, options: [{ series: { type: "bar" } }] },
    ],
    [
      "timeline options nested in baseOption",
      {
        series: TOP_LEVEL_SERIES,
        baseOption: { options: [null, { series: [{ type: "bar" }] }] },
      },
    ],
  ])("uses getOption when %s can override the series", (_label, parsed) => {
    const chart = chartStub()

    expect(resolveSelectionOption(parsed, chart)).toBe(RESOLVED_OPTION)
    expect(chart.getOption).toHaveBeenCalledTimes(1)
  })

  it("falls back to the parsed spec when getOption is not an object", () => {
    const parsed = { baseOption: { timeline: { data: ["2015"] } } }

    expect(resolveSelectionOption(parsed, chartStub(null))).toBe(parsed)
  })
})

describe("normalizeNativeSelection", () => {
  /** A graph series in ``multiple`` mode with three nodes and two links. */
  const graphOption = {
    series: [
      {
        type: "graph",
        selectedMode: "multiple",
        data: [{}, {}, {}],
        links: [{}, {}],
      },
    ],
  }

  const previousEdges: SelectedEntry = {
    seriesIndex: 0,
    dataType: "edge",
    dataIndex: [1],
  }

  it.each<{
    label: string
    fromAction?: string
    payloadType?: string
    dataIndex: number[]
    expectedNodes: number[]
  }>([
    {
      label: "select adds the action indices",
      fromAction: "select",
      dataIndex: [2],
      expectedNodes: [0, 1, 2],
    },
    {
      label: "unselect removes the action indices",
      fromAction: "unselect",
      dataIndex: [1],
      expectedNodes: [0],
    },
    {
      label: "toggleSelect flips each action index",
      fromAction: "toggleSelect",
      dataIndex: [1, 2],
      expectedNodes: [0, 2],
    },
    {
      label: "a toggle payload type flips each action index",
      payloadType: "toggleSelect",
      dataIndex: [0],
      expectedNodes: [1],
    },
    {
      label: "toggling off every selected node drops the node group",
      fromAction: "toggleSelect",
      dataIndex: [0, 1],
      expectedNodes: [],
    },
  ])(
    "in multiple mode, $label",
    ({ fromAction, payloadType, dataIndex, expectedNodes }) => {
      const previous: SelectedEntry[] = [
        { seriesIndex: 0, dataType: "node", dataIndex: [0, 1] },
        previousEdges,
      ]
      const params: SelectChangedParams = {
        fromAction,
        fromActionPayload: {
          type: payloadType,
          seriesIndex: 0,
          dataType: "node",
          dataIndex,
        },
        // ECharts repeats the shared node/edge index map in its snapshot.
        selected: [
          { seriesIndex: 0, dataType: "node", dataIndex: [9] },
          { seriesIndex: 0, dataType: "edge", dataIndex: [9] },
        ],
      }

      const next = normalizeNativeSelection(
        previous,
        params,
        () => graphOption
      )

      const nodeGroups = next.filter(entry => entry.dataType === "node")
      expect(nodeGroups).toHaveLength(expectedNodes.length > 0 ? 1 : 0)
      expect(
        (nodeGroups[0]?.dataIndex ?? []).toSorted((a, b) => a - b)
      ).toEqual(expectedNodes)
      // The untouched edge group is preserved, not replaced by the snapshot.
      expect(next.filter(entry => entry.dataType === "edge")).toEqual([
        previousEdges,
      ])
    }
  )

  it("keeps the snapshot when the action series is missing from the option", () => {
    const previous: SelectedEntry[] = [
      { seriesIndex: 1, dataType: "edge", dataIndex: [2] },
    ]
    const params: SelectChangedParams = {
      fromAction: "select",
      fromActionPayload: { seriesIndex: 3, dataType: "node", dataIndex: 0 },
      selected: [
        { seriesIndex: 1, dataType: "node", dataIndex: [2] },
        { seriesIndex: 1, dataType: "edge", dataIndex: [2] },
        { seriesIndex: 3, dataType: "node", dataIndex: [0] },
      ],
    }

    expect(
      normalizeNativeSelection(previous, params, () => graphOption)
    ).toEqual([
      // Series 1 keeps its reconstructed groups instead of the repeated
      // snapshot entries.
      { seriesIndex: 1, dataType: "edge", dataIndex: [2] },
      { seriesIndex: 3, dataType: "node", dataIndex: [0] },
    ])
  })
})

describe("buildSelectionState", () => {
  it("skips selected entries without a numeric series index", () => {
    const state = buildSelectionState(
      { series: [{ id: "points", name: "Points" }] },
      [
        { seriesIndex: undefined, dataIndex: [5] } as unknown as SelectedEntry,
        { seriesIndex: 0, dataIndex: [2, 1] },
      ],
      [
        {
          brushIndex: 0,
          selected: [
            { seriesIndex: "0", dataIndex: [7] } as unknown as SelectedEntry,
            { seriesIndex: 0, dataIndex: [3] },
          ],
        },
      ]
    )

    expect(state.selected).toEqual([
      {
        series_index: 0,
        series_id: "points",
        series_name: "Points",
        data_type: "main",
        data_indices: [1, 2, 3],
      },
    ])
    expect(state.areas).toEqual([])
  })
})
