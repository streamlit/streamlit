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

import { screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { DeckGlJsonChart as DeckGlJsonChartProto } from "@streamlit/protobuf"

import { render } from "~lib/components/shared/ElementFullscreen/testUtils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { DeckGlJsonChart } from "./DeckGlJsonChart"
import type { DeckGLProps } from "./types"

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

vi.mock("~lib/theme", async () => ({
  ...(await vi.importActual<typeof import("~lib/theme")>("~lib/theme")),
  hasLightBackgroundColor: () => mockHasLightBackgroundColor(),
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
          props.element,
          JSON.stringify({
            selection: {
              indices: { "0533490f-fcf9-4dc0-8c94-ae4fbd42eb6f": [0] },
              objects: { "0533490f-fcf9-4dc0-8c94-ae4fbd42eb6f": [{}] },
            },
          }),
          { fromUi: true },
          props.fragmentId
        )
      }

      render(<DeckGlJsonChart {...props} disabled={disabled} />)

      expect(
        screen.queryByLabelText("Clear selection")
      ).not.toBeInTheDocument()
    }
  )

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
})
