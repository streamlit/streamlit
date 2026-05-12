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

import {
  DeckGlJsonChart as DeckGlJsonChartProto,
  streamlit,
} from "@streamlit/protobuf"

import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import {
  render,
  renderHook,
} from "~lib/components/shared/ElementFullscreen/testUtils"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { mockTheme } from "~lib/mocks/mockTheme"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { useDeckGl, UseDeckGlProps } from "./useDeckGl"

/** Test component that wires useDeckGl to the ElementFullscreenContext expand button. */
const DeckGlFullscreenTestComponent: FC<UseDeckGlProps> = props => {
  useDeckGl(props)
  const { expand } = useRequiredContext(ElementFullscreenContext)

  return (
    <button type="button" onClick={expand}>
      Expand
    </button>
  )
}

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

      render(<DeckGlFullscreenTestComponent {...getUseDeckGlProps()} />)

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

  describe("selection sanitization", () => {
    const getPropsWithArrayData = (
      data: unknown[],
      layerId: string | null = "test-layer"
    ): UseDeckGlProps => {
      const layer: Record<string, unknown> = {
        "@@type": "ScatterplotLayer",
        data,
        getPosition: "@@=[lng, lat]",
        pickable: true,
      }

      if (layerId !== null) {
        layer.id = layerId
      }

      const json = {
        initialViewState: mockInitialViewState,
        layers: [layer],
      }

      return {
        element: DeckGlJsonChartProto.create({
          id: "test-element-id",
          json: JSON.stringify(json),
          selectionMode: [DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT],
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

    it("should remove selection when layer is removed", () => {
      // Start with data and a selection
      const initialData = [
        { lat: 1, lng: 1 },
        { lat: 2, lng: 2 },
        { lat: 3, lng: 3 },
      ]
      const initialProps = getPropsWithArrayData(
        initialData,
        "layer-to-remove"
      )

      const { result, rerender } = renderHook(props => useDeckGl(props), {
        initialProps,
      })

      // Set a selection on the layer
      act(() => {
        result.current.setSelection({
          fromUi: true,
          value: {
            selection: {
              indices: { "layer-to-remove": [0, 1] },
              objects: { "layer-to-remove": [{}, {}] },
            },
          },
        })
      })

      // Rerender to apply the selection
      rerender(initialProps)
      expect(result.current.data.selection.indices["layer-to-remove"]).toEqual(
        [0, 1]
      )

      // Now remove the layer by providing a different layer
      const newProps = getPropsWithArrayData(initialData, "different-layer")
      rerender(newProps)

      // Selection for removed layer should be cleared
      expect(
        result.current.data.selection.indices["layer-to-remove"]
      ).toBeUndefined()
    })

    it("should remove orphaned indices when data shrinks", () => {
      // Start with 5 items
      const initialData = [
        { lat: 1, lng: 1 },
        { lat: 2, lng: 2 },
        { lat: 3, lng: 3 },
        { lat: 4, lng: 4 },
        { lat: 5, lng: 5 },
      ]
      const initialProps = getPropsWithArrayData(
        initialData,
        "shrinking-layer"
      )

      const { result, rerender } = renderHook(props => useDeckGl(props), {
        initialProps,
      })

      // Select items at indices 2 and 4
      act(() => {
        result.current.setSelection({
          fromUi: true,
          value: {
            selection: {
              indices: { "shrinking-layer": [2, 4] },
              objects: { "shrinking-layer": [{}, {}] },
            },
          },
        })
      })

      rerender(initialProps)
      expect(result.current.data.selection.indices["shrinking-layer"]).toEqual(
        [2, 4]
      )

      // Shrink to 3 items - index 4 is now invalid
      const shrunkData = [
        { lat: 1, lng: 1 },
        { lat: 2, lng: 2 },
        { lat: 3, lng: 3 },
      ]
      const shrunkProps = getPropsWithArrayData(shrunkData, "shrinking-layer")
      rerender(shrunkProps)

      // Only index 2 should remain (index 4 is out of bounds)
      expect(result.current.data.selection.indices["shrinking-layer"]).toEqual(
        [2]
      )
    })

    it("should preserve selection when layers have no explicit IDs", () => {
      const initialData = [
        { lat: 1, lng: 1 },
        { lat: 2, lng: 2 },
      ]
      const initialProps = getPropsWithArrayData(initialData, null)

      const { result, rerender } = renderHook(props => useDeckGl(props), {
        initialProps,
      })

      const unknownLayerId = "auto-layer-id"
      act(() => {
        result.current.setSelection({
          fromUi: true,
          value: {
            selection: {
              indices: { [unknownLayerId]: [0] },
              objects: { [unknownLayerId]: [{}] },
            },
          },
        })
      })

      rerender(initialProps)

      const updatedData = [
        { lat: 1, lng: 1 },
        { lat: 2, lng: 2 },
        { lat: 3, lng: 3 },
      ]
      const updatedProps = getPropsWithArrayData(updatedData, null)
      rerender(updatedProps)

      expect(result.current.data.selection.indices[unknownLayerId]).toEqual([
        0,
      ])
    })

    it("should remove orphaned selection when spec has mixed layers with and without IDs", () => {
      // This tests the bug where hasUnknownLayerId being true would incorrectly
      // preserve selections for layers that don't exist in the spec.
      //
      // Scenario:
      // 1. Initial spec has layer "A" (with ID) and layer "B" (no ID)
      // 2. User has selection for "layer-A" and stale selection for "old-layer"
      // 3. Spec changes (data update) - triggers sanitization
      // 4. "old-layer" should be removed even though hasUnknownLayerId is true
      //    because layerData.size > 0 means we CAN validate layer existence

      // Helper to create props with multiple layers
      const getPropsWithMultipleLayers = (
        layers: Array<{
          data: unknown[]
          id: string | null
        }>
      ): UseDeckGlProps => {
        const layerConfigs = layers.map(l => {
          const layer: Record<string, unknown> = {
            "@@type": "ScatterplotLayer",
            data: l.data,
            getPosition: "@@=[lng, lat]",
            pickable: true,
          }
          if (l.id !== null) {
            layer.id = l.id
          }
          return layer
        })

        const json = {
          initialViewState: mockInitialViewState,
          layers: layerConfigs,
        }

        return {
          element: DeckGlJsonChartProto.create({
            id: "test-element-id",
            json: JSON.stringify(json),
            selectionMode: [DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT],
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

      const initialData = [
        { lat: 1, lng: 1 },
        { lat: 2, lng: 2 },
      ]

      // Initial: layer "A" (with ID) and layer "B" (no ID)
      const initialProps = getPropsWithMultipleLayers([
        { data: initialData, id: "layer-A" },
        { data: initialData, id: null }, // layer B has no ID
      ])

      const { result, rerender } = renderHook(props => useDeckGl(props), {
        initialProps,
      })

      // Set selections on layer "A" and a non-existent "old-layer"
      act(() => {
        result.current.setSelection({
          fromUi: true,
          value: {
            selection: {
              indices: {
                "layer-A": [0],
                "old-layer": [1],
              },
              objects: {
                "layer-A": [{ lat: 1, lng: 1 }],
                "old-layer": [{ lat: 2, lng: 2 }],
              },
            },
          },
        })
      })

      rerender(initialProps)

      // Both selections should be present after initial selection
      // (sanitization hasn't run yet because spec hasn't changed)
      expect(result.current.data.selection.indices["layer-A"]).toEqual([0])
      expect(result.current.data.selection.indices["old-layer"]).toEqual([1])

      // Now change the spec data to trigger sanitization
      // Layer structure stays the same (A with ID, B without), just data changes
      const updatedData = [
        { lat: 1, lng: 1 },
        { lat: 2, lng: 2 },
        { lat: 3, lng: 3 }, // added one more item
      ]
      const updatedProps = getPropsWithMultipleLayers([
        { data: updatedData, id: "layer-A" },
        { data: updatedData, id: null },
      ])
      rerender(updatedProps)

      // "layer-A" selection should be preserved (layer still exists)
      expect(result.current.data.selection.indices["layer-A"]).toEqual([0])

      // "old-layer" selection should be REMOVED with the fix.
      // Before the fix: hasUnknownLayerId=true would preserve it (BUG!)
      // With the fix: layerData.size=1 (layer-A exists), so we can validate
      // layer existence and "old-layer" is clearly not in the spec.
      expect(
        result.current.data.selection.indices["old-layer"]
      ).toBeUndefined()
    })

    it("should preserve selection for layers with URL data", () => {
      // Create props with URL data (non-array)
      const propsWithUrlData = getUseDeckGlProps({
        selectionMode: [DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT],
        id: "test-element-id",
      })

      const { result, rerender } = renderHook(props => useDeckGl(props), {
        initialProps: propsWithUrlData,
      })

      // Set a selection on the URL-data layer
      const layerId = "0533490f-fcf9-4dc0-8c94-ae4fbd42eb6f"
      act(() => {
        result.current.setSelection({
          fromUi: true,
          value: {
            selection: {
              indices: { [layerId]: [5, 10, 15] },
              objects: { [layerId]: [{}, {}, {}] },
            },
          },
        })
      })

      rerender(propsWithUrlData)

      // Selection should be preserved since we can't validate URL data indices
      expect(result.current.data.selection.indices[layerId]).toEqual([
        5, 10, 15,
      ])
    })

    it("should clear all selections when data shrinks to empty", () => {
      // Start with data
      const initialData = [
        { lat: 1, lng: 1 },
        { lat: 2, lng: 2 },
      ]
      const initialProps = getPropsWithArrayData(initialData, "emptying-layer")

      const { result, rerender } = renderHook(props => useDeckGl(props), {
        initialProps,
      })

      // Select item at index 0
      act(() => {
        result.current.setSelection({
          fromUi: true,
          value: {
            selection: {
              indices: { "emptying-layer": [0] },
              objects: { "emptying-layer": [{}] },
            },
          },
        })
      })

      rerender(initialProps)
      expect(result.current.data.selection.indices["emptying-layer"]).toEqual([
        0,
      ])

      // Shrink to empty array
      const emptyProps = getPropsWithArrayData([], "emptying-layer")
      rerender(emptyProps)

      // Selection should be cleared (no valid indices)
      expect(
        result.current.data.selection.indices["emptying-layer"]
      ).toBeUndefined()
    })

    it("should refresh selection objects when data changes", () => {
      const initialData = [
        { id: "a", lat: 1, lng: 1 },
        { id: "b", lat: 2, lng: 2 },
      ]
      const initialProps = getPropsWithArrayData(initialData, "object-layer")

      const { result, rerender } = renderHook(props => useDeckGl(props), {
        initialProps,
      })

      act(() => {
        result.current.setSelection({
          fromUi: true,
          value: {
            selection: {
              indices: { "object-layer": [1] },
              objects: { "object-layer": [{ id: "b", lat: 2, lng: 2 }] },
            },
          },
        })
      })

      rerender(initialProps)

      const updatedData = [
        { id: "a", lat: 1, lng: 1 },
        { id: "b-updated", lat: 2, lng: 2 },
      ]
      const updatedProps = getPropsWithArrayData(updatedData, "object-layer")
      rerender(updatedProps)

      expect(result.current.data.selection.objects["object-layer"][0]).toEqual(
        updatedData[1]
      )
    })
  })

  describe("width configuration", () => {
    it("should use container width when widthConfig.useStretch is true", () => {
      const widthConfig = new streamlit.WidthConfig({ useStretch: true })
      const initialProps = {
        ...getUseDeckGlProps(),
        widthConfig,
      }

      const { result } = renderHook(props => useDeckGl(props), {
        initialProps,
      })

      // When useStretch is true, width should be "100%" (container width)
      expect(result.current.width).toBe("100%")
    })

    it("should not use container width when widthConfig is undefined", () => {
      const initialProps = getUseDeckGlProps()

      const { result } = renderHook(props => useDeckGl(props), {
        initialProps,
      })

      // When widthConfig is undefined, width should not be 100%
      // It falls back to the initialViewState width or default
      expect(result.current.width).not.toBe("100%")
    })

    it("should not use container width when widthConfig.useStretch is false", () => {
      const widthConfig = new streamlit.WidthConfig({ useStretch: false })
      const initialProps = {
        ...getUseDeckGlProps(),
        widthConfig,
      }

      const { result } = renderHook(props => useDeckGl(props), {
        initialProps,
      })

      expect(result.current.width).not.toBe("100%")
    })
  })
})
