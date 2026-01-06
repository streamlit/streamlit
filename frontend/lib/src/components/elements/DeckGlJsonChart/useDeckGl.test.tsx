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

import { FC } from "react"

import { PickingInfo, ViewStateChangeParameters } from "@deck.gl/core"
import { act, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import JSON5 from "json5"

import { DeckGlJsonChart as DeckGlJsonChartProto } from "@streamlit/protobuf"

import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import {
  render,
  renderHook,
} from "~lib/components/shared/ElementFullscreen/testUtils"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { mockTheme } from "~lib/mocks/mockTheme"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { useDeckGl, UseDeckGlProps } from "./useDeckGl"

const mockInitialViewState = {
  bearing: -27.36,
  latitude: 52.2323,
  longitude: -1.415,
  maxZoom: 15,
  minZoom: 5,
  pitch: 40.5,
  height: 500,
  zoom: 6,
}

const getUseDeckGlProps = (
  elementProps: Partial<DeckGlJsonChartProto> = {},
  initialViewStateProps: Record<string, unknown> = {}
): UseDeckGlProps => {
  const json = {
    initialViewState: mockInitialViewState,
    layers: [
      {
        "@@type": "HexagonLayer",
        autoHighlight: true,
        coverage: 1,
        data: "https://raw.githubusercontent.com/uber-common/deck.gl-data/master/examples/3d-heatmap/heatmap-data.csv",
        elevationRange: [0, 3000],
        elevationScale: 50,
        extruded: true,
        getPosition: "@@=[lng, lat]",
        id: "0533490f-fcf9-4dc0-8c94-ae4fbd42eb6f",
        pickable: true,
      },
    ],
    mapStyle: "mapbox://styles/mapbox/light-v9",
    views: [{ "@@type": "MapView", controller: true }],
  }

  json.initialViewState = {
    ...json.initialViewState,
    ...initialViewStateProps,
  }

  return {
    element: DeckGlJsonChartProto.create({
      json: JSON.stringify(json),
      ...elementProps,
    }),
    widgetMgr: new WidgetStateManager({
      sendRerunBackMsg: vi.fn(),
      formsDataChanged: vi.fn(),
    }),
    fragmentId: "myFragmentId",
    isLightTheme: false,
    theme: mockTheme.emotion,
  }
}

describe("useDeckGl", () => {
  it("should apply server viewState changes as a diff to the current state", () => {
    const initialProps = getUseDeckGlProps()

    const { result, rerender } = renderHook(props => useDeckGl(props), {
      initialProps,
    })

    expect(result.current.viewState).toEqual(mockInitialViewState)

    // Server sends new zoom value
    rerender({
      ...initialProps,
      element: getUseDeckGlProps({}, { zoom: 8 }).element,
    })

    // Should reflect the merged server change (zoom: 8)
    expect(result.current.viewState).toEqual({
      ...mockInitialViewState,
      zoom: 8,
    })
  })

  describe("createTooltip", () => {
    it.each([
      {
        description: "info is null",
        props: {},
        info: null,
      },
      {
        description: "info.object is undefined",
        props: {},
        info: {} as PickingInfo,
      },
      {
        description: "element.tooltip is undefined",
        props: { tooltip: undefined },
        info: { object: {} } as PickingInfo,
      },
      {
        description: "element.tooltip is empty string",
        props: { tooltip: "" },
        info: { object: { elevationValue: 10 } } as PickingInfo,
      },
    ])("should return null when $description", ({ props, info }) => {
      const {
        result: { current },
      } = renderHook(hookProps => useDeckGl(hookProps), {
        initialProps: getUseDeckGlProps(props),
      })

      expect(current.createTooltip(info)).toBe(null)
    })

    it.each([
      {
        description: "direct object property",
        object: { elevationValue: 10 },
        expected: "<b>Elevation Value:</b> 10",
      },
      {
        description: "nested properties field",
        object: { properties: { elevationValue: 10 } },
        expected: "<b>Elevation Value:</b> 10",
      },
      {
        description: "unexpected schema (no interpolation)",
        object: { unexpectedSchema: { elevationValue: 10 } },
        expected: "<b>Elevation Value:</b> {elevationValue}",
      },
    ])(
      "should interpolate html correctly with $description",
      ({ object, expected }) => {
        const {
          result: { current },
        } = renderHook(hookProps => useDeckGl(hookProps), {
          initialProps: getUseDeckGlProps({
            tooltip: JSON.stringify({
              html: "<b>Elevation Value:</b> {elevationValue}",
            }),
          }),
        })

        const result = current.createTooltip({ object } as PickingInfo)

        if (result === null || typeof result !== "object") {
          throw new Error("Expected result to be an object")
        }

        expect(result.html).toBe(expected)
      }
    )
  })

  describe("deck memo behavior", () => {
    const newJson = {
      initialViewState: mockInitialViewState,
      mapStyle: "mapbox://styles/mapbox/light-v9",
    }

    // Store reference to original parse function for proper cleanup
    const originalParse = JSON5.parse

    beforeEach(() => {
      vi.spyOn(JSON5, "parse").mockReturnValue(newJson)
    })

    afterEach(() => {
      // Restore only the JSON5.parse mock to avoid affecting other global mocks
      JSON5.parse = originalParse
    })

    it.each([
      {
        description: "should call JSON5.parse when the json is different",
        newProps: getUseDeckGlProps(undefined, { zoom: 19 }),
      },
      {
        description: "should call JSON5.parse when theme state changes",
        newProps: { isLightTheme: true },
      },
    ])("$description", ({ newProps }) => {
      const initialProps = getUseDeckGlProps()
      const { rerender } = renderHook(props => useDeckGl(props), {
        initialProps,
      })

      expect(JSON5.parse).toHaveBeenCalledTimes(1)

      rerender({ ...initialProps, ...newProps })

      expect(JSON5.parse).toHaveBeenCalledTimes(2)
    })

    it("should call JSON5.parse when isFullScreen changes", async () => {
      const user = userEvent.setup()
      const MyComponent: FC<UseDeckGlProps> = props => {
        useDeckGl(props)
        const { expand } = useRequiredContext(ElementFullscreenContext)

        return (
          <button type="button" onClick={expand}>
            Expand
          </button>
        )
      }

      render(<MyComponent {...getUseDeckGlProps()} />)

      expect(JSON5.parse).toHaveBeenCalledTimes(1)

      await user.click(screen.getByText("Expand"))

      expect(JSON5.parse).toHaveBeenCalledTimes(2)
    })
  })

  describe("selectionMode", () => {
    it.each([
      {
        description: "undefined when allSelectionModes is empty",
        selectionMode: [],
        expected: undefined,
      },
      {
        description: "SINGLE_OBJECT when that mode is provided",
        selectionMode: [DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT],
        expected: DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT,
      },
      {
        description: "MULTI_OBJECT when that mode is provided",
        selectionMode: [DeckGlJsonChartProto.SelectionMode.MULTI_OBJECT],
        expected: DeckGlJsonChartProto.SelectionMode.MULTI_OBJECT,
      },
      {
        description: "the first mode when multiple are given",
        selectionMode: [
          DeckGlJsonChartProto.SelectionMode.MULTI_OBJECT,
          DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT,
        ],
        expected: DeckGlJsonChartProto.SelectionMode.MULTI_OBJECT,
      },
    ])("should be $description", ({ selectionMode, expected }) => {
      const initialProps = getUseDeckGlProps({ selectionMode })
      const { result } = renderHook(hookProps => useDeckGl(hookProps), {
        initialProps,
      })
      expect(result.current.selectionMode).toBe(expected)
    })
  })

  describe("isSelectionModeActivated", () => {
    it.each([
      {
        description: "true when selectionMode is defined",
        selectionMode: [DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT],
        expected: true,
      },
      {
        description: "false when selectionMode is empty",
        selectionMode: [],
        expected: false,
      },
    ])("should be $description", ({ selectionMode, expected }) => {
      const initialProps = getUseDeckGlProps({ selectionMode })
      const { result } = renderHook(hookProps => useDeckGl(hookProps), {
        initialProps,
      })
      expect(result.current.isSelectionModeActivated).toBe(expected)
    })
  })

  describe("hasActiveSelection", () => {
    it("should be false when selection is empty", () => {
      const initialProps = getUseDeckGlProps({
        selectionMode: [DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT],
      })
      const { result } = renderHook(props => useDeckGl(props), {
        initialProps,
      })
      expect(result.current.hasActiveSelection).toBe(false)
    })

    it("should be true when selection is not empty", () => {
      const initialProps = getUseDeckGlProps({
        selectionMode: [DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT],
      })
      const { result, rerender } = renderHook(props => useDeckGl(props), {
        initialProps,
      })

      act(() => {
        result.current.setSelection({
          fromUi: true,
          value: {
            selection: {
              indices: { "0533490f-fcf9-4dc0-8c94-ae4fbd42eb6f": [0] },
              objects: { "0533490f-fcf9-4dc0-8c94-ae4fbd42eb6f": [{}] },
            },
          },
        })
      })

      rerender(initialProps)

      expect(result.current.hasActiveSelection).toBe(true)
    })
  })

  describe("onViewStateChange", () => {
    it("should update viewState when called", () => {
      const initialProps = getUseDeckGlProps()
      const { result } = renderHook(props => useDeckGl(props), {
        initialProps,
      })

      const newViewState = {
        ...mockInitialViewState,
        zoom: 10,
        latitude: 55.0,
      }

      act(() => {
        result.current.onViewStateChange({
          viewState: newViewState,
        } as ViewStateChangeParameters)
      })

      expect(result.current.viewState).toEqual(newViewState)
    })
  })
})
