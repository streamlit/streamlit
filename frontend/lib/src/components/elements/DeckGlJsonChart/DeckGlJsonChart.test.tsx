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

import { type ReactNode } from "react"

import { act, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { DeckGlJsonChart as DeckGlJsonChartProto } from "@streamlit/protobuf"

import { render } from "~lib/components/shared/ElementFullscreen/testUtils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { DeckGlJsonChart } from "./DeckGlJsonChart"
import type { DeckGlElementState, DeckGLProps } from "./types"

type MockPickingInfo = {
  index: number
  object?: unknown
  layer?: { id?: string }
}

const { deckGlOnClickRef } = vi.hoisted(() => ({
  deckGlOnClickRef: {
    current: undefined as ((info: MockPickingInfo) => void) | undefined,
  },
}))

// deck.gl needs a WebGL context that jsdom does not provide, so the real
// DeckGL never dispatches map clicks. Capture `onClick` and invoke it
// directly to exercise selection logic. Render children so StaticMap and
// navigation controls still mount.
vi.mock("@deck.gl/react", () => ({
  DeckGL: ({
    onClick,
    children,
  }: {
    onClick?: (info: MockPickingInfo) => void
    children?: ReactNode
  }) => {
    deckGlOnClickRef.current = onClick
    return <div data-testid="mockDeckGL">{children}</div>
  },
}))

const mockLayerId = "0533490f-fcf9-4dc0-8c94-ae4fbd42eb6f"

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

const mockHasLightBackgroundColor = vi.fn(() => false)

vi.mock("~lib/theme/getColors", async () => ({
  ...(await vi.importActual<typeof import("~lib/theme/getColors")>(
    "~lib/theme/getColors"
  )),
  hasLightBackgroundColor: () => mockHasLightBackgroundColor(),
}))

const getProps = (
  elementProps: Partial<DeckGlJsonChartProto> = {},
  initialViewStateProps: Record<string, unknown> = {},
  jsonOverrides: Record<string, unknown> = {}
): DeckGLProps => {
  const json: Record<string, unknown> = {
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
    ...jsonOverrides,
  }

  json.initialViewState = {
    ...(json.initialViewState as Record<string, unknown>),
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
  }
}

describe("DeckGlJsonChart", () => {
  it("should render with correct test id and className", () => {
    const props = getProps()
    render(<DeckGlJsonChart {...props} />)
    const element = screen.getByTestId("stDeckGlJsonChart")
    expect(element).toBeVisible()
    expect(element).toHaveClass("stDeckGlJsonChart")
  })

  describe("basemap chrome", () => {
    it("renders zoom controls for a MapView with a basemap style", async () => {
      render(<DeckGlJsonChart {...getProps()} />)

      await waitFor(() => {
        expect(screen.getByTestId("mockDeckGL")).toBeVisible()
      })
      expect(screen.getByTestId("stDeckGlJsonChartZoomButton")).toBeVisible()
      expect(screen.getByTitle("Zoom In")).toBeVisible()
    })

    it("renders zoom controls when the spec omits views", async () => {
      render(<DeckGlJsonChart {...getProps({}, {}, { views: undefined })} />)

      await waitFor(() => {
        expect(screen.getByTestId("mockDeckGL")).toBeVisible()
      })
      expect(screen.getByTestId("stDeckGlJsonChartZoomButton")).toBeVisible()
      expect(screen.getByTitle("Zoom In")).toBeVisible()
    })

    it("renders zoom controls when an unknown view type falls back to MapView", async () => {
      render(
        <DeckGlJsonChart
          {...getProps(
            {},
            {},
            { views: [{ "@@type": "NotARealView", controller: true }] }
          )}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId("mockDeckGL")).toBeVisible()
      })
      expect(screen.getByTestId("stDeckGlJsonChartZoomButton")).toBeVisible()
      expect(screen.getByTitle("Zoom In")).toBeVisible()
    })

    it("does not render zoom controls when mapStyle is the pydeck unset sentinel", async () => {
      render(
        <DeckGlJsonChart
          {...getProps({}, {}, { mapStyle: "__MAP_STYLE__" })}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId("mockDeckGL")).toBeVisible()
      })
      expect(
        screen.queryByTestId("stDeckGlJsonChartZoomButton")
      ).not.toBeInTheDocument()
      expect(screen.queryByTitle("Zoom In")).not.toBeInTheDocument()
    })

    it("does not render zoom controls for OrbitView", async () => {
      render(
        <DeckGlJsonChart
          {...getProps(
            {},
            {},
            {
              views: [{ "@@type": "OrbitView", controller: true }],
              mapStyle: "__MAP_STYLE__",
              initialViewState: {
                target: [0, 0, 0],
                zoom: 5,
                rotationX: 15,
                rotationOrbit: 30,
              },
            }
          )}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId("mockDeckGL")).toBeVisible()
      })
      expect(
        screen.queryByTestId("stDeckGlJsonChartZoomButton")
      ).not.toBeInTheDocument()
      expect(screen.queryByTitle("Zoom In")).not.toBeInTheDocument()
    })
  })

  it.each([
    {
      description: "no active selection",
      setupSelection: false,
      disabled: false,
    },
    {
      description: "disabled state with selection",
      setupSelection: true,
      disabled: true,
    },
  ])(
    "should not render clear selection button when $description",
    ({ setupSelection, disabled }) => {
      const props = getProps({
        selectionMode: [DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT],
      })

      if (setupSelection) {
        props.widgetMgr.setStringValue(
          props.element.id,
          JSON.stringify({
            selection: {
              indices: { [mockLayerId]: [0] },
              objects: { [mockLayerId]: [{}] },
            },
          }),
          {
            formId: props.element.formId,
            fragmentId: props.fragmentId,
            fromUser: true,
          }
        )
      }

      render(<DeckGlJsonChart {...props} disabled={disabled} />)

      expect(
        screen.queryByLabelText("Clear selection")
      ).not.toBeInTheDocument()
    }
  )

  it("should render clear selection button when there is an active selection and not disabled", async () => {
    const props = getProps({
      selectionMode: [DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT],
      id: "test-element-id",
    })

    // Set up an active selection
    props.widgetMgr.setStringValue(
      props.element.id,
      JSON.stringify({
        selection: {
          indices: { [mockLayerId]: [0] },
          objects: { [mockLayerId]: [{ testProp: "value" }] },
        },
      }),
      {
        formId: props.element.formId,
        fragmentId: props.fragmentId,
        fromUser: true,
      }
    )

    render(<DeckGlJsonChart {...props} />)

    const chart = screen.getByTestId("stDeckGlJsonChart")
    await userEvent.hover(chart)

    await waitFor(() => {
      expect(screen.getByLabelText("Clear selection")).toBeVisible()
    })
  })

  it("should render clear selection button for multi-object selection mode", async () => {
    const props = getProps({
      selectionMode: [DeckGlJsonChartProto.SelectionMode.MULTI_OBJECT],
      id: "test-element-id",
    })

    // Set up an active multi-selection
    props.widgetMgr.setStringValue(
      props.element.id,
      JSON.stringify({
        selection: {
          indices: { [mockLayerId]: [0, 2, 4] },
          objects: { [mockLayerId]: [{}, {}, {}] },
        },
      }),
      {
        formId: props.element.formId,
        fragmentId: props.fragmentId,
        fromUser: true,
      }
    )

    render(<DeckGlJsonChart {...props} />)

    const chart = screen.getByTestId("stDeckGlJsonChart")
    await userEvent.hover(chart)

    await waitFor(() => {
      expect(screen.getByLabelText("Clear selection")).toBeVisible()
    })
  })

  describe("fullscreen mode", () => {
    it("should render expand button by default", async () => {
      const props = getProps()
      render(<DeckGlJsonChart {...props} />)
      const chart = screen.getByTestId("stDeckGlJsonChart")
      await userEvent.hover(chart)

      await waitFor(() => {
        expect(screen.getByLabelText("Fullscreen")).toBeVisible()
      })
    })

    it("should not render fullscreen button when disableFullscreenMode is true", async () => {
      const props = getProps()
      render(<DeckGlJsonChart {...props} disableFullscreenMode />)
      const chart = screen.getByTestId("stDeckGlJsonChart")
      await userEvent.hover(chart)

      // We use a hardcoded timeout here because we're testing a negative assertion
      // (that something does NOT appear). Unlike positive assertions where we can
      // wait for an element to appear, there's no reliable way to "wait for something
      // to not appear" - we need to give sufficient time for it to potentially render.
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(screen.queryByLabelText("Fullscreen")).not.toBeInTheDocument()
    })
  })

  describe("object selection", () => {
    const EMPTY_SELECTION: DeckGlElementState["selection"] = {
      indices: {},
      objects: {},
    }

    beforeEach(() => {
      deckGlOnClickRef.current = undefined
    })

    const getStoredSelection = (
      props: DeckGLProps
    ): DeckGlElementState["selection"] | undefined => {
      const raw = props.widgetMgr.getStringValue({ id: props.element.id })
      if (!raw) {
        return undefined
      }
      return (JSON.parse(raw) as DeckGlElementState).selection
    }

    const clickMap = async (info: MockPickingInfo): Promise<void> => {
      await waitFor(() => {
        expect(deckGlOnClickRef.current).toBeDefined()
      })
      act(() => {
        deckGlOnClickRef.current?.({
          layer: { id: mockLayerId },
          ...info,
        })
      })
    }

    const seedSelection = (
      props: DeckGLProps,
      selection: DeckGlElementState["selection"]
    ): void => {
      props.widgetMgr.setStringValue(
        props.element.id,
        JSON.stringify({ selection }),
        {
          formId: props.element.formId,
          fragmentId: props.fragmentId,
          fromUser: true,
        }
      )
    }

    it("does not attach a click handler when selection is not activated", async () => {
      render(<DeckGlJsonChart {...getProps()} />)

      await waitFor(() => {
        expect(screen.getByTestId("mockDeckGL")).toBeVisible()
      })
      expect(deckGlOnClickRef.current).toBeUndefined()
    })

    it("does not attach a click handler when the chart is disabled", async () => {
      const props = getProps({
        selectionMode: [DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT],
        id: "disabled-selection",
      })
      render(<DeckGlJsonChart {...props} disabled />)

      await waitFor(() => {
        expect(screen.getByTestId("mockDeckGL")).toBeVisible()
      })
      expect(deckGlOnClickRef.current).toBeUndefined()
      expect(
        screen.queryByLabelText("Clear selection")
      ).not.toBeInTheDocument()
    })

    it("selects a single object on click", async () => {
      const props = getProps({
        selectionMode: [DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT],
        id: "single-select",
      })
      render(<DeckGlJsonChart {...props} />)

      await clickMap({
        index: 2,
        object: { name: "hex" },
      })

      expect(getStoredSelection(props)).toEqual({
        indices: { [mockLayerId]: [2] },
        objects: { [mockLayerId]: [{ name: "hex" }] },
      })
    })

    it("unselects the same object when clicked again in single-object mode", async () => {
      const props = getProps({
        selectionMode: [DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT],
        id: "single-unselect",
      })
      seedSelection(props, {
        indices: { [mockLayerId]: [2] },
        objects: { [mockLayerId]: [{ name: "hex" }] },
      })
      render(<DeckGlJsonChart {...props} />)

      await clickMap({
        index: 2,
        object: { name: "hex" },
      })

      expect(getStoredSelection(props)).toEqual(EMPTY_SELECTION)
    })

    it("does not update selection when clicking empty map space with nothing selected", async () => {
      const props = getProps({
        selectionMode: [DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT],
        id: "empty-reset-click",
      })
      render(<DeckGlJsonChart {...props} />)

      const setStringValueSpy = vi.spyOn(props.widgetMgr, "setStringValue")

      await clickMap({ index: -1 })

      expect(setStringValueSpy).not.toHaveBeenCalled()
    })

    it("clears selection when the user clicks empty map space", async () => {
      const props = getProps({
        selectionMode: [DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT],
        id: "reset-click",
      })
      seedSelection(props, {
        indices: { [mockLayerId]: [1] },
        objects: { [mockLayerId]: [{ name: "hex" }] },
      })
      render(<DeckGlJsonChart {...props} />)

      await clickMap({ index: -1 })

      expect(getStoredSelection(props)).toEqual(EMPTY_SELECTION)
    })

    it("adds objects in multi-object mode", async () => {
      const props = getProps({
        selectionMode: [DeckGlJsonChartProto.SelectionMode.MULTI_OBJECT],
        id: "multi-add",
      })
      seedSelection(props, {
        indices: { [mockLayerId]: [0] },
        objects: { [mockLayerId]: [{ id: 0 }] },
      })
      render(<DeckGlJsonChart {...props} />)

      await clickMap({
        index: 3,
        object: { id: 3 },
      })

      expect(getStoredSelection(props)).toEqual({
        indices: { [mockLayerId]: [0, 3] },
        objects: { [mockLayerId]: [{ id: 0 }, { id: 3 }] },
      })
    })

    it("removes a clicked object from a multi-object selection", async () => {
      const props = getProps({
        selectionMode: [DeckGlJsonChartProto.SelectionMode.MULTI_OBJECT],
        id: "multi-remove",
      })
      seedSelection(props, {
        indices: { [mockLayerId]: [0, 3] },
        objects: { [mockLayerId]: [{ id: 0 }, { id: 3 }] },
      })
      render(<DeckGlJsonChart {...props} />)

      await clickMap({
        index: 0,
        object: { id: 0 },
      })

      expect(getStoredSelection(props)).toEqual({
        indices: { [mockLayerId]: [3] },
        objects: { [mockLayerId]: [{ id: 3 }] },
      })
    })

    it("drops a layer from multi-object selection when its last object is unselected", async () => {
      const otherLayerId = "other-layer"
      const props = getProps({
        selectionMode: [DeckGlJsonChartProto.SelectionMode.MULTI_OBJECT],
        id: "multi-drop-layer",
      })
      seedSelection(props, {
        indices: { [mockLayerId]: [1], [otherLayerId]: [4] },
        objects: { [mockLayerId]: [{ id: 1 }], [otherLayerId]: [{ id: 4 }] },
      })
      render(<DeckGlJsonChart {...props} />)

      await clickMap({
        index: 1,
        object: { id: 1 },
      })

      expect(getStoredSelection(props)).toEqual({
        indices: { [otherLayerId]: [4] },
        objects: { [otherLayerId]: [{ id: 4 }] },
      })
    })

    it("clears selection from the toolbar button", async () => {
      const props = getProps({
        selectionMode: [DeckGlJsonChartProto.SelectionMode.SINGLE_OBJECT],
        id: "clear-button",
      })
      seedSelection(props, {
        indices: { [mockLayerId]: [0] },
        objects: { [mockLayerId]: [{ testProp: "value" }] },
      })
      render(<DeckGlJsonChart {...props} />)

      await userEvent.hover(screen.getByTestId("stDeckGlJsonChart"))
      await userEvent.click(await screen.findByLabelText("Clear selection"))

      expect(getStoredSelection(props)).toEqual(EMPTY_SELECTION)
    })
  })
})
