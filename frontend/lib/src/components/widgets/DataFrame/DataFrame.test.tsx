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

import * as glideDataGridModule from "@glideapps/glide-data-grid"
import { screen } from "@testing-library/react"

import { Dataframe as DataframeProto } from "@streamlit/protobuf"

import { Quiver } from "~lib/dataframes/Quiver"
import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { TEN_BY_TEN } from "~lib/mocks/arrow"
import { render } from "~lib/test_util"

vi.mock("@glideapps/glide-data-grid", async () => ({
  ...(await vi.importActual("@glideapps/glide-data-grid")),
  DataEditor: vi.fn(props => <div {...props} />),
}))

// The native-file-system-adapter creates some issues in the test environment
// so we mock it out. The errors might be related to the missing typescript
// distribution. But the file picker most likely wouldn't work anyways in jest-dom.
vi.mock("native-file-system-adapter", () => ({}))

import DataFrame, { DataFrameProps } from "./DataFrame"

const getProps = (
  data: Quiver,
  editingMode: DataframeProto.EditingMode = DataframeProto.EditingMode
    .READ_ONLY
): DataFrameProps => ({
  element: DataframeProto.create({
    arrowData: { data: new Uint8Array() },
    editingMode,
  }),
  data,
  disabled: false,
  widgetMgr: {
    getStringValue: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  } as any,
})

const { ResizeObserver } = window

describe("DataFrame widget", () => {
  const props = getProps(new Quiver({ data: TEN_BY_TEN }))

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [250],
    })
  })

  afterEach(() => {
    window.ResizeObserver = ResizeObserver
    vi.restoreAllMocks()
  })

  it("renders without crashing", () => {
    render(<DataFrame {...props} />)
    expect(screen.getAllByTestId("stDataFrameResizable").length).toBe(1)
  })

  it("renders when widgetMgr is undefined", () => {
    const propsWithoutWidgetMgr = {
      ...getProps(new Quiver({ data: TEN_BY_TEN })),
      widgetMgr: undefined,
    }

    render(<DataFrame {...propsWithoutWidgetMgr} />)

    // If it renders, the main container should be in the document
    expect(screen.getByTestId("stDataFrame")).toBeVisible()
  })

  it("should have correct className", () => {
    render(<DataFrame {...props} />)

    const styledResizableContainer = screen.getByTestId("stDataFrame")

    expect(styledResizableContainer).toHaveClass("stDataFrame")
  })

  it("should have a toolbar", () => {
    render(<DataFrame {...props} />)

    const dataframeToolbar = screen.getByTestId("stElementToolbar")

    expect(dataframeToolbar).toBeInTheDocument()

    const toolbarButtons = screen.getAllByTestId("stElementToolbarButton")
    expect(toolbarButtons).toHaveLength(3)
  })

  it("Touch detection correctly deactivates some features", () => {
    // Set window.matchMedia to simulate a touch device
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
    }))

    render(
      <DataFrame
        {...getProps(
          new Quiver({ data: TEN_BY_TEN }),
          DataframeProto.EditingMode.FIXED
        )}
      />
    )
    // You have to set a second arg with {} to test work and get the received props
    expect(glideDataGridModule.DataEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        rangeSelect: "cell",
        fillHandle: false,
        onColumnResize: undefined,
      }),
      {}
    )
  })

  it("enables trailing row for ADD_ONLY editing mode", () => {
    render(
      <DataFrame
        {...getProps(
          new Quiver({ data: TEN_BY_TEN }),
          DataframeProto.EditingMode.ADD_ONLY
        )}
      />
    )

    // ADD_ONLY mode should enable trailingRowOptions for adding rows
    expect(glideDataGridModule.DataEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        trailingRowOptions: expect.objectContaining({
          sticky: false,
          tint: true,
        }),
      }),
      {}
    )

    // ADD_ONLY mode should NOT enable row deletion features
    expect(glideDataGridModule.DataEditor).not.toHaveBeenCalledWith(
      expect.objectContaining({
        rowSelect: "multi",
        rowSelectionMode: "multi",
      }),
      {}
    )
  })

  it("enables row selection for DELETE_ONLY editing mode", () => {
    render(
      <DataFrame
        {...getProps(
          new Quiver({ data: TEN_BY_TEN }),
          DataframeProto.EditingMode.DELETE_ONLY
        )}
      />
    )

    // DELETE_ONLY mode should enable row selection for deleting rows
    expect(glideDataGridModule.DataEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        rowSelect: "multi",
        rowSelectionMode: "multi",
      }),
      {}
    )

    // DELETE_ONLY mode should NOT enable row adding features
    expect(glideDataGridModule.DataEditor).not.toHaveBeenCalledWith(
      expect.objectContaining({
        trailingRowOptions: expect.anything(),
      }),
      {}
    )
  })

  it("enables both trailing row and row selection for DYNAMIC editing mode", () => {
    render(
      <DataFrame
        {...getProps(
          new Quiver({ data: TEN_BY_TEN }),
          DataframeProto.EditingMode.DYNAMIC
        )}
      />
    )

    // DYNAMIC mode should enable both adding and deleting rows
    expect(glideDataGridModule.DataEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        trailingRowOptions: expect.objectContaining({
          sticky: false,
          tint: true,
        }),
        rowSelect: "multi",
        rowSelectionMode: "multi",
      }),
      {}
    )
  })
})
