/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React, { FC } from "react"

import JSON5 from "json5"
import { act, screen } from "@testing-library/react"
import { PickingInfo } from "@deck.gl/core"
import userEvent from "@testing-library/user-event"

import {
  render,
  renderHook,
} from "@streamlit/lib/src/components/shared/ElementFullscreen/testUtils"
import { DeckGlJsonChart as DeckGlJsonChartProto } from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import { mockTheme } from "@streamlit/lib/src/mocks/mockTheme"
import { ElementFullscreenContext } from "@streamlit/lib/src/components/shared/ElementFullscreen/ElementFullscreenContext"
import { useRequiredContext } from "@streamlit/lib/src/hooks/useRequiredContext"
import "@testing-library/jest-dom"

import type { DeckGLProps } from "./types"
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

jest.mock("@streamlit/lib/src/theme", () => ({
  ...jest.requireActual("@streamlit/lib/src/theme"),
  hasLightBackgroundColor: jest.fn(() => false),
}))

const getProps = (
  elementProps: Partial<DeckGlJsonChartProto> = {},
  initialViewStateProps: Record<string, unknown> = {}
): DeckGLProps => {
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
    mapboxToken: "mapboxToken",
    widgetMgr: new WidgetStateManager({
      sendRerunBackMsg: jest.fn(),
      formsDataChanged: jest.fn(),
    }),
    fragmentId: "myFragmentId",
  }
}

const getUseDeckGlProps = (
  elementProps: Partial<DeckGlJsonChartProto> = {},
  initialViewStateProps: Record<string, unknown> = {}
): UseDeckGlProps => {
  return {
    ...getProps(elementProps, initialViewStateProps),
    isLightTheme: false,
    theme: mockTheme.emotion,
  }
}

describe("#useDeckGl", () => {
  it("should merge client and server changes in viewState", () => {
    const initialProps = getUseDeckGlProps()

    const {
      result: { current },
      rerender,
    } = renderHook(props => useDeckGl(props), {
      initialProps,
    })

    expect(current.viewState).toEqual(mockInitialViewState)

    rerender({
      ...initialProps,
      element: getUseDeckGlProps({}, { zoom: 8 }).element,
    })

    // should match original mockInitialViewState
    expect(current.viewState).toEqual({ ...mockInitialViewState, zoom: 6 })
  })

  describe("createTooltip", () => {
    it("should return null if info is null", () => {
      const {
        result: { current },
      } = renderHook(props => useDeckGl(props), {
        initialProps: getUseDeckGlProps(),
      })

      expect(current.createTooltip(null)).toBe(null)
    })

    it("should return null if info.object is undefined", () => {
      const {
        result: { current },
      } = renderHook(props => useDeckGl(props), {
        initialProps: getUseDeckGlProps(),
      })

      expect(current.createTooltip({} as PickingInfo)).toBe(null)
    })

    it("should return null if element.tooltip is undefined", () => {
      const {
        result: { current },
      } = renderHook(props => useDeckGl(props), {
        initialProps: getUseDeckGlProps({ tooltip: undefined }),
      })

      expect(current.createTooltip({ object: {} } as PickingInfo)).toBe(null)
    })

    it("should interpolate the html with the correct object", () => {
      const {
        result: { current },
      } = renderHook(props => useDeckGl(props), {
        initialProps: getUseDeckGlProps({
          tooltip: JSON.stringify({
            html: "<b>Elevation Value:</b> {elevationValue}",
          }),
        }),
      })

      const result = current.createTooltip({
        object: { elevationValue: 10 },
      } as PickingInfo)

      if (result === null || typeof result !== "object") {
        throw new Error("Expected result to be an object")
      }

      expect(result.html).toBe("<b>Elevation Value:</b> 10")
    })

    it("should interpolate the html from object with a properties field", () => {
      const {
        result: { current },
      } = renderHook(props => useDeckGl(props), {
        initialProps: getUseDeckGlProps({
          tooltip: JSON.stringify({
            html: "<b>Elevation Value:</b> {elevationValue}",
          }),
        }),
      })

      const result = current.createTooltip({
        object: { properties: { elevationValue: 10 } },
      } as PickingInfo)

      if (result === null || typeof result !== "object") {
        throw new Error("Expected result to be an object")
      }

      expect(result.html).toBe("<b>Elevation Value:</b> 10")
    })

    it("should return the tooltip unchanged when object does have an expected schema", () => {
      const {
        result: { current },
      } = renderHook(props => useDeckGl(props), {
        initialProps: getUseDeckGlProps({
          tooltip: JSON.stringify({
            html: "<b>Elevation Value:</b> {elevationValue}",
          }),
        }),
      })

      const result = current.createTooltip({
        object: { unexpectedSchema: { elevationValue: 10 } },
      } as PickingInfo)

      if (result === null || typeof result !== "object") {
        throw new Error("Expected result to be an object")
      }

      expect(result.html).toBe("<b>Elevation Value:</b> {elevationValue}")
    })

    it("should interpolate the html with the an empty string", () => {
      const {
        result: { current },
      } = renderHook(props => useDeckGl(props), {
        initialProps: getUseDeckGlProps({ tooltip: "" }),
      })

      const result = current.createTooltip({
        object: { elevationValue: 10 },
      } as PickingInfo)

      expect(result).toBe(null)
    })
  })

  describe("deck", () => {
    const newJson = {
      initialViewState: mockInitialViewState,
      mapStyle: "mapbox://styles/mapbox/light-v9",
    }

    const mockJsonParse = jest.fn().mockReturnValue(newJson)

    beforeEach(() => {
      JSON5.parse = mockJsonParse
    })

    afterEach(() => {
      mockJsonParse.mockClear()
    })

    const testCases: {
      description: string
      newProps: Partial<UseDeckGlProps>
    }[] = [
      {
        description: "should call JSON5.parse when the json is different",
        newProps: getUseDeckGlProps(undefined, { zoom: 19 }),
      },
      {
        description: "should call JSON5.parse when theme state changes",
        newProps: { isLightTheme: true },
      },
    ]

    it.each(testCases)("$description", ({ newProps }) => {
      const initialProps = getUseDeckGlProps()
      const { rerender } = renderHook(props => useDeckGl(props), {
        initialProps,
      })

      expect(JSON5.parse).toHaveBeenCalledTimes(1)

      rerender({ ...initialProps, ...newProps })

      expect(JSON5.parse).toHaveBeenCalledTimes(2)
    })

    it("should call JSON5.parse when isFullScreen changes", async () => {
      const MyComponent: FC<UseDeckGlProps> = props => {
        useDeckGl(props)
        const { expand } = useRequiredContext(ElementFullscreenContext)

        return <button onClick={expand}>Expand</button>
      }

      render(<MyComponent {...getUseDeckGlProps()} />)

      expect(JSON5.parse).toHaveBeenCalledTimes(1)

      await userEvent.click(screen.getByText("Expand"))

      expect(JSON5.parse).toHaveBeenCalledTimes(2)
    })
  })

  describe("selectionMode", () => {
    it("should be undefined when allSelectionModes is empty", () => {
      const initialProps = getUseDeckGlProps({ selectionMode: [] })
      const { result } = renderHook(props => useDeckGl(props), {
        initialProps,
      })
      expect(result.current.selectionMode).toBeUndefined()
    })

    it("should be defined when allSelectionModes has single object select", () => {
      const initialProps = getUseDeckGlProps({
        selectionMode: [DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT],
      })
      const { result } = renderHook(props => useDeckGl(props), {
        initialProps,
      })
      expect(result.current.selectionMode).toBe(
        DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT
      )
    })

    it("should be defined when allSelectionModes has multi object select", () => {
      const initialProps = getUseDeckGlProps({
        selectionMode: [DeckGlJsonChartProto.SelectionMode.MULTI_OBJECT],
      })
      const { result } = renderHook(props => useDeckGl(props), {
        initialProps,
      })
      expect(result.current.selectionMode).toBe(
        DeckGlJsonChartProto.SelectionMode.MULTI_OBJECT
      )
    })

    it("should return the first selection mode given, if multiple are given", () => {
      const initialProps = getUseDeckGlProps({
        selectionMode: [
          DeckGlJsonChartProto.SelectionMode.MULTI_OBJECT,
          DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT,
        ],
      })
      const { result } = renderHook(props => useDeckGl(props), {
        initialProps,
      })
      expect(result.current.selectionMode).toBe(
        DeckGlJsonChartProto.SelectionMode.MULTI_OBJECT
      )
    })
  })

  describe("isSelectionModeActivated", () => {
    it("should activate selection mode when selectionMode is defined", () => {
      const initialProps = getUseDeckGlProps({
        selectionMode: [DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT],
      })
      const { result } = renderHook(props => useDeckGl(props), {
        initialProps,
      })
      expect(result.current.isSelectionModeActivated).toBe(true)
    })

    it("should not activate selection mode when selectionMode is undefined", () => {
      const initialProps = getUseDeckGlProps({ selectionMode: [] })
      const { result } = renderHook(props => useDeckGl(props), {
        initialProps,
      })
      expect(result.current.isSelectionModeActivated).toBe(false)
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

      rerender()

      expect(result.current.hasActiveSelection).toBe(true)
    })
  })
})
