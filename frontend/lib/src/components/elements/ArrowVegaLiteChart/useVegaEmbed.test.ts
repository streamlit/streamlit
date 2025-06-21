/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { act, renderHook } from "@testing-library/react"
import { View as VegaView } from "vega"
import embed from "vega-embed"
import { expressionInterpreter } from "vega-interpreter"
import { Mock, Mocked } from "vitest"

import { useFormClearHelper } from "~lib/components/widgets/Form"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { getDataArrays, getInlineData } from "./arrowUtils"
import { useVegaEmbed } from "./useVegaEmbed"
import { useVegaLiteSelections } from "./useVegaLiteSelections"

// Mock the "vega-embed" library:
vi.mock("vega-embed", () => ({
  __esModule: true,
  default: vi.fn(),
}))

// Mock "useVegaLiteSelections" so we can observe calls:
vi.mock("./useVegaLiteSelections", () => ({
  __esModule: true,
  useVegaLiteSelections: vi.fn(),
}))

// Mock "useFormClearHelper" to ensure it is called:
vi.mock("~lib/components/widgets/Form", () => ({
  __esModule: true,
  useFormClearHelper: vi.fn(),
}))

// Utility mock for getDataArrays / getInlineData from arrowUtils:
vi.mock("./arrowUtils", async () => {
  // We'll only re-implement the named functions used in code.
  const actual = await vi.importActual<object>("./arrowUtils")
  return {
    __esModule: true,
    ...actual,
    getDataArrays: vi.fn(),
    getInlineData: vi.fn(),
  }
})

// We don't necessarily need to mock all `WidgetStateManager` methods, but let's do so:
const createMockWidgetMgr = (): Mocked<WidgetStateManager> =>
  ({
    getElementState: vi.fn(),
    setElementState: vi.fn(),
    getStringValue: vi.fn(),
    setStringValue: vi.fn(),
  }) as unknown as Mocked<WidgetStateManager>

// ------------------------------------------
// 2. The Tests
// ------------------------------------------

describe("useVegaEmbed hook", () => {
  let mockWidgetMgr: Mocked<WidgetStateManager>
  let mockVegaView: Mocked<VegaView>
  let mockEmbedReturn: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    vgSpec: any
    view: Mocked<VegaView>
    finalize: () => void
  }

  beforeEach(() => {
    vi.resetAllMocks()

    mockWidgetMgr = createMockWidgetMgr()
    mockVegaView = {
      insert: vi.fn().mockReturnThis(),
      resize: vi.fn().mockReturnThis(),
      runAsync: vi.fn().mockResolvedValue(null),
      setState: vi.fn().mockReturnThis(),
      data: vi.fn().mockReturnThis(),
      remove: vi.fn().mockReturnThis(),
    } as unknown as Mocked<VegaView>

    // vega-embed returns { vgSpec, view, finalize }
    mockEmbedReturn = {
      vgSpec: { data: [{}] },
      view: mockVegaView,
      finalize: vi.fn(),
    }

    // By default, embed(...) resolves to our mockEmbedReturn
    ;(embed as unknown as Mock).mockResolvedValue(mockEmbedReturn)

    // Mock useVegaLiteSelections returns two callbacks:
    ;(useVegaLiteSelections as Mock).mockReturnValue({
      maybeConfigureSelections: vi
        .fn()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
        .mockImplementation((view: any) => view),
      onFormCleared: vi.fn(),
    })

    // Default stubs:
    ;(useFormClearHelper as Mock).mockImplementation(() => {})
    ;(getDataArrays as Mock).mockReturnValue({})
    ;(getInlineData as Mock).mockReturnValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("creates a new Vega view via embed, finalizes existing view, inserts data, and returns a VegaView", async () => {
    const containerRef = { current: null }
    const chartElement = {
      id: "chartId",
      data: null,
      datasets: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    } as any

    // mount hook
    const { result } = renderHook(() =>
      useVegaEmbed(chartElement, mockWidgetMgr)
    )

    // Create a mock div to pass as containerRef
    const div = document.createElement("div")
    // @ts-expect-error We simulate a ref j
    containerRef.current = div

    // Act: call createView
    let returnedView: VegaView | null = null
    await act(async () => {
      returnedView = await result.current.createView(containerRef, {})
    })

    // 1) Existing view is finalized (nothing yet, so finalize no-op):
    expect(mockEmbedReturn.finalize).not.toHaveBeenCalled()

    // 2) embed(...) is called with containerRef.current and spec
    expect(embed).toHaveBeenCalledWith(
      div,
      {},
      {
        ast: true,
        expr: expressionInterpreter,
        tooltip: { disableDefaultStyle: true },
        defaultStyle: false,
        forceActionsMenu: true,
      }
    )

    // 3) the returned vegaView is stored
    expect(returnedView).toBe(mockVegaView)

    // 4) maybeConfigureSelections is called
    const useVegaLiteSelectionsMock = (useVegaLiteSelections as Mock).mock

    const { maybeConfigureSelections } =
      useVegaLiteSelectionsMock.results[0].value
    expect(maybeConfigureSelections).toHaveBeenCalledWith(mockVegaView)

    // 5) Insert data (getInlineData => null, so none inserted)
    expect(mockVegaView.insert).not.toHaveBeenCalled() // if getInlineData was null
    expect(mockVegaView.runAsync).toHaveBeenCalled() // runAsync

    // 6) Resizes the new vega view
    expect(mockVegaView.resize).toHaveBeenCalled()
    expect(mockVegaView.runAsync).toHaveBeenCalled()
  })

  it("finalizes old view if one exists before creating a new one", async () => {
    const containerRef = { current: null }
    const chartElement = {
      id: "chartId",
      data: null,
      datasets: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    } as any

    // mount hook
    const { result } = renderHook(() =>
      useVegaEmbed(chartElement, mockWidgetMgr)
    )

    // Suppose we have an existing view in place, so let's do a first call:
    // We ensure finalize is set on the first creation
    {
      const div = document.createElement("div")
      // @ts-expect-error We want the ref to be set correctly
      containerRef.current = div

      await act(async () => {
        await result.current.createView(containerRef, {})
      })
    }
    // Now, embed.finalize hasn't been called yet because we just created it once
    expect(mockEmbedReturn.finalize).not.toHaveBeenCalled()

    // Now we do a second call to createView => it should finalize old view
    const secondDiv = document.createElement("div")
    // @ts-expect-error We want the ref to be set correctly
    containerRef.current = secondDiv

    await act(async () => {
      await result.current.createView(containerRef, {})
    })

    // The old finalize method is now called
    expect(mockEmbedReturn.finalize).toHaveBeenCalledTimes(1)
  })

  it("throws an error if containerRef is missing", async () => {
    const chartElement = {
      id: "chartId",
      data: null,
      datasets: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    } as any

    const { result } = renderHook(() =>
      useVegaEmbed(chartElement, mockWidgetMgr)
    )

    await expect(
      result.current.createView({ current: null }, {})
    ).rejects.toThrowError("Element missing.")

    expect(embed).not.toHaveBeenCalled()
  })

  it("finalizeView finalizes and clears references", async () => {
    const chartElement = {
      id: "chartId",
      data: null,
      datasets: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    } as any
    const { result } = renderHook(() =>
      useVegaEmbed(chartElement, mockWidgetMgr)
    )

    const containerRef = { current: null }
    // @ts-expect-error We want the ref to be set correctly
    containerRef.current = document.createElement("div")

    // createView => embed => sets vegaFinalizer
    await act(async () => {
      await result.current.createView(containerRef, {})
    })

    // The finalize function is provided by vega-embed
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      result.current.finalizeView()
    })
    expect(mockEmbedReturn.finalize).toHaveBeenCalled()

    // The stored references are cleared (not easily tested directly,
    // but if we tried to re-finalize, finalize shouldn't be called again):
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      result.current.finalizeView()
    })
    // finalize is not called a second time
    expect(mockEmbedReturn.finalize).toHaveBeenCalledTimes(1)
  })

  it("updateView returns null if no vegaView is present", async () => {
    const chartElement = {
      id: "chartId",
      data: null,
      datasets: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    } as any
    const { result } = renderHook(() =>
      useVegaEmbed(chartElement, mockWidgetMgr)
    )

    let updatedView: VegaView | null = null
    await act(async () => {
      updatedView = await result.current.updateView(null, [])
    })
    expect(updatedView).toBeNull()
  })

  it("updateView updates data and datasets, then runs async", async () => {
    const chartElement = {
      id: "chartId",
      data: null,
      datasets: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    } as any

    const { result } = renderHook(() =>
      useVegaEmbed(chartElement, mockWidgetMgr)
    )

    const containerRef = { current: null }
    // @ts-expect-error We want the ref to be set correctly
    containerRef.current = document.createElement("div")

    // createView => ensures vegaView isn't null
    await act(async () => {
      await result.current.createView(containerRef, {})
    })

    const quiverData = {
      data: { numRows: 5, numCols: 2 },
      dimensions: { dataRows: 5, dataCols: 2 },
      isEmpty: () => false,
      columnTypes: { index: ["int"], data: ["int"] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    } as any

    await act(async () => {
      await result.current.updateView(quiverData, [])
    })

    // We can verify that it tried to update data sets in the vegaView
    // Because `updateData` calls `view.data` or `view.insert`
    expect(mockVegaView.insert).toHaveBeenCalledTimes(1)
    // 2 from createView, 1 from updateView -> .resize().runAsync()
    expect(mockVegaView.runAsync).toHaveBeenCalledTimes(3)
  })
})
