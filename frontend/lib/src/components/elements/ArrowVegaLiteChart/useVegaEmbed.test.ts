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

import { act, renderHook } from "@testing-library/react"
import { View as VegaView } from "vega"
import embed, { type VisualizationSpec } from "vega-embed"
import { expressionInterpreter } from "vega-interpreter"
import { Mock, Mocked } from "vitest"

import { useFormClearHelper } from "~lib/components/widgets/Form/FormClearHelper"
import { Quiver } from "~lib/dataframes/Quiver"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  getDataArray,
  getDataArrays,
  getInlineData,
  VegaLiteChartElement,
  WrappedNamedDataset,
} from "./arrowUtils"
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
vi.mock("~lib/components/widgets/Form/FormClearHelper", () => ({
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
    getDataArray: vi.fn(),
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
    vgSpec: Record<string, unknown>
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
      width: vi.fn().mockReturnThis(),
      height: vi.fn().mockReturnThis(),
      toImageURL: vi.fn().mockResolvedValue("data:image/png;base64,mock"),
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
        .mockImplementation((view: VegaView) => view),
      onFormCleared: vi.fn(),
    })

    // Default stubs:
    ;(useFormClearHelper as Mock).mockImplementation(() => {})
    ;(getDataArrays as Mock).mockReturnValue({})
    ;(getInlineData as Mock).mockReturnValue(null)
    ;(getDataArray as Mock).mockReturnValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("creates a new Vega view via embed, finalizes existing view, inserts data, and returns a VegaView", async () => {
    const containerRef = { current: null }
    const chartElement: VegaLiteChartElement = {
      id: "chartId",
      data: null,
      datasets: [],
      spec: "",
      useContainerWidth: false,
      vegaLiteTheme: "",
      selectionMode: [],
      formId: "",
    }

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
        actions: false,
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
    const chartElement: VegaLiteChartElement = {
      id: "chartId",
      data: null,
      datasets: [],
      spec: "",
      useContainerWidth: false,
      vegaLiteTheme: "",
      selectionMode: [],
      formId: "",
    }

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
    const chartElement: VegaLiteChartElement = {
      id: "chartId",
      data: null,
      datasets: [],
      spec: "",
      useContainerWidth: false,
      vegaLiteTheme: "",
      selectionMode: [],
      formId: "",
    }

    const { result } = renderHook(() =>
      useVegaEmbed(chartElement, mockWidgetMgr)
    )

    await expect(
      result.current.createView({ current: null }, {})
    ).rejects.toThrow("Element missing.")

    expect(embed).not.toHaveBeenCalled()
  })

  it("finalizeView finalizes and clears references", async () => {
    const chartElement: VegaLiteChartElement = {
      id: "chartId",
      data: null,
      datasets: [],
      spec: "",
      useContainerWidth: false,
      vegaLiteTheme: "",
      selectionMode: [],
      formId: "",
    }
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
    const chartElement: VegaLiteChartElement = {
      id: "chartId",
      data: null,
      datasets: [],
      spec: "",
      useContainerWidth: false,
      vegaLiteTheme: "",
      selectionMode: [],
      formId: "",
    }
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
    const chartElement: VegaLiteChartElement = {
      id: "chartId",
      data: null,
      datasets: [],
      spec: "",
      useContainerWidth: false,
      vegaLiteTheme: "",
      selectionMode: [],
      formId: "",
    }

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
    } as unknown as Quiver

    await act(async () => {
      await result.current.updateView(quiverData, [])
    })

    // We can verify that it tried to update data sets in the vegaView
    // Because `updateData` calls `view.data` or `view.insert`
    expect(mockVegaView.insert).toHaveBeenCalledTimes(1)
    // 2 from createView, 1 from updateView -> .resize().runAsync()
    expect(mockVegaView.runAsync).toHaveBeenCalledTimes(3)
  })

  it("uses latest props data/datasets on createView after rerender", async () => {
    const initialElement: VegaLiteChartElement = {
      id: "chartId",
      data: null,
      datasets: [
        {
          name: "old",
          hasName: true,
          data: { dimensions: { numDataRows: 1 } } as Quiver,
        },
      ],
      spec: "",
      useContainerWidth: false,
      vegaLiteTheme: "",
      selectionMode: [],
      formId: "",
    }

    const { result, rerender } = renderHook(
      ({ element }) => useVegaEmbed(element, mockWidgetMgr),
      { initialProps: { element: initialElement } }
    )

    const updatedDatasets = [
      { name: "new", hasName: true, data: { dimensions: { numDataRows: 1 } } },
    ] as unknown
    const updatedElement = {
      ...initialElement,
      datasets: updatedDatasets,
    } as VegaLiteChartElement
    ;(getInlineData as Mock).mockReturnValue(null)
    ;(getDataArrays as Mock).mockReturnValue({ new: [{ x: 1 }] })

    rerender({ element: updatedElement })

    const containerRef = { current: document.createElement("div") }

    await act(async () => {
      await result.current.createView(containerRef, {})
    })

    // getDataArrays should have been called with the latest datasets
    const lastCallArg = (getDataArrays as Mock).mock.calls.at(-1)?.[0]
    expect(lastCallArg).toBe(updatedDatasets)
    // Named rows are merged into the embed spec so Vega-Lite can compile them.
    expect(embed).toHaveBeenCalledWith(
      containerRef.current,
      expect.objectContaining({ datasets: { new: [{ x: 1 }] } }),
      expect.anything()
    )
    expect(mockVegaView.insert).not.toHaveBeenCalledWith("new", [{ x: 1 }])
  })

  it("uses single dataset name as default for inline data insert", async () => {
    const element: VegaLiteChartElement = {
      id: "chartId",
      data: null,
      datasets: [],
      spec: "",
      useContainerWidth: false,
      vegaLiteTheme: "",
      selectionMode: [],
      formId: "",
    }

    const { result } = renderHook(() => useVegaEmbed(element, mockWidgetMgr))

    const inline = [{ d: "inline" }]
    ;(getInlineData as Mock).mockReturnValue(inline)
    ;(getDataArrays as Mock).mockReturnValue({ only: [{ d: "ds" }] })

    const containerRef = { current: document.createElement("div") }
    await act(async () => {
      await result.current.createView(containerRef, {})
    })

    // Named rows go to the embed spec; insert is only the unnamed inline data.
    expect(embed).toHaveBeenCalledWith(
      containerRef.current,
      expect.objectContaining({ datasets: { only: [{ d: "ds" }] } }),
      expect.anything()
    )
    expect(mockVegaView.insert).toHaveBeenCalledTimes(1)
    expect(mockVegaView.insert).toHaveBeenCalledWith("only", inline)
  })

  it("merges named arrow datasets into existing spec.datasets before embed", async () => {
    const element: VegaLiteChartElement = {
      id: "chartId",
      data: null,
      datasets: [],
      spec: "",
      useContainerWidth: false,
      vegaLiteTheme: "",
      selectionMode: [],
      formId: "",
    }

    const { result } = renderHook(() => useVegaEmbed(element, mockWidgetMgr))

    const featureCollection = {
      type: "FeatureCollection",
      features: [],
    }
    const spec = { datasets: { geo: featureCollection } }
    ;(getInlineData as Mock).mockReturnValue(null)
    ;(getDataArrays as Mock).mockReturnValue({
      lookup: [{ id: 1, population: 10 }],
    })

    const containerRef = { current: document.createElement("div") }
    await act(async () => {
      await result.current.createView(
        containerRef,
        spec as unknown as VisualizationSpec
      )
    })

    expect(embed).toHaveBeenCalledWith(
      containerRef.current,
      expect.objectContaining({
        datasets: {
          geo: featureCollection,
          lookup: [{ id: 1, population: 10 }],
        },
      }),
      expect.anything()
    )
    expect(spec.datasets).toEqual({ geo: featureCollection })
    expect(mockVegaView.insert).not.toHaveBeenCalled()
  })

  it("passes string specs to embed without parsing them as JSON", async () => {
    const element: VegaLiteChartElement = {
      id: "chartId",
      data: null,
      datasets: [],
      spec: "",
      useContainerWidth: false,
      vegaLiteTheme: "",
      selectionMode: [],
      formId: "",
    }

    const { result } = renderHook(() => useVegaEmbed(element, mockWidgetMgr))
    ;(getInlineData as Mock).mockReturnValue(null)
    ;(getDataArrays as Mock).mockReturnValue({ lookup: [{ id: 1 }] })

    const containerRef = { current: document.createElement("div") }
    const specUrl = "https://example.invalid/spec.json"
    await act(async () => {
      await result.current.createView(containerRef, specUrl)
    })

    expect(embed).toHaveBeenCalledWith(
      containerRef.current,
      specUrl,
      expect.anything()
    )
    expect(mockVegaView.insert).toHaveBeenCalledWith("lookup", [{ id: 1 }])
  })

  it("replays named datasets that change while embed is pending", async () => {
    let resolveEmbed!: (value: typeof mockEmbedReturn) => void
    ;(embed as unknown as Mock).mockImplementation(
      () =>
        new Promise(resolve => {
          resolveEmbed = resolve
        })
    )

    const oldDatasets = [
      {
        name: "lookup",
        hasName: true,
        data: { dimensions: { numDataRows: 1 }, hash: "old" },
      },
    ] as WrappedNamedDataset[]
    const newDatasets = [
      {
        name: "lookup",
        hasName: true,
        data: { dimensions: { numDataRows: 1 }, hash: "new" },
      },
    ] as WrappedNamedDataset[]

    const initialElement: VegaLiteChartElement = {
      id: "chartId",
      data: null,
      datasets: oldDatasets,
      spec: "",
      useContainerWidth: false,
      vegaLiteTheme: "",
      selectionMode: [],
      formId: "",
    }

    const { result, rerender } = renderHook(
      ({ element }) => useVegaEmbed(element, mockWidgetMgr),
      { initialProps: { element: initialElement } }
    )

    ;(getInlineData as Mock).mockReturnValue(null)
    ;(getDataArrays as Mock).mockReturnValue({ lookup: [{ id: 1 }] })
    ;(getDataArray as Mock).mockReturnValue([{ id: 2 }])

    const containerRef = { current: document.createElement("div") }
    let createPromise!: Promise<VegaView | null>
    act(() => {
      createPromise = result.current.createView(containerRef, {})
    })

    rerender({
      element: { ...initialElement, datasets: newDatasets },
    })

    await act(async () => {
      const skipped = await result.current.updateView(null, newDatasets)
      expect(skipped).toBeNull()
    })

    await act(async () => {
      resolveEmbed(mockEmbedReturn)
      await createPromise
    })

    expect(mockVegaView.data).toHaveBeenCalledWith("lookup", [{ id: 2 }])
  })

  it("replays a second named-dataset update that arrives during deferred runAsync", async () => {
    let resolveEmbed!: (value: typeof mockEmbedReturn) => void
    ;(embed as unknown as Mock).mockImplementation(
      () =>
        new Promise(resolve => {
          resolveEmbed = resolve
        })
    )

    let runAsyncCalls = 0
    let resolveReplayRun!: () => void
    let thirdRunStarted!: () => void
    const thirdRunStartedPromise = new Promise<void>(resolve => {
      thirdRunStarted = resolve
    })
    mockVegaView.runAsync.mockImplementation(() => {
      runAsyncCalls += 1
      if (runAsyncCalls === 3) {
        thirdRunStarted()
        return new Promise<VegaView>(resolve => {
          resolveReplayRun = () => {
            resolve(mockVegaView)
          }
        })
      }
      return Promise.resolve(mockVegaView)
    })

    const datasetsA = [
      {
        name: "lookup",
        hasName: true,
        data: { dimensions: { numDataRows: 1 }, hash: "a" },
      },
    ] as WrappedNamedDataset[]
    const datasetsB = [
      {
        name: "lookup",
        hasName: true,
        data: { dimensions: { numDataRows: 1 }, hash: "b" },
      },
    ] as WrappedNamedDataset[]
    const datasetsC = [
      {
        name: "lookup",
        hasName: true,
        data: { dimensions: { numDataRows: 1 }, hash: "c" },
      },
    ] as WrappedNamedDataset[]

    const initialElement: VegaLiteChartElement = {
      id: "chartId",
      data: null,
      datasets: datasetsA,
      spec: "",
      useContainerWidth: false,
      vegaLiteTheme: "",
      selectionMode: [],
      formId: "",
    }

    const { result, rerender } = renderHook(
      ({ element }) => useVegaEmbed(element, mockWidgetMgr),
      { initialProps: { element: initialElement } }
    )

    ;(getInlineData as Mock).mockReturnValue(null)
    ;(getDataArrays as Mock).mockReturnValue({ lookup: [{ id: 1 }] })
    ;(getDataArray as Mock).mockImplementation((quiver: { hash?: string }) => [
      { id: quiver.hash },
    ])

    const containerRef = { current: document.createElement("div") }
    let createPromise!: Promise<VegaView | null>
    act(() => {
      createPromise = result.current.createView(containerRef, {})
    })

    rerender({
      element: { ...initialElement, datasets: datasetsB },
    })

    await act(async () => {
      const skipped = await result.current.updateView(null, datasetsB)
      expect(skipped).toBeNull()
    })

    await act(async () => {
      resolveEmbed(mockEmbedReturn)
      await thirdRunStartedPromise
    })

    rerender({
      element: { ...initialElement, datasets: datasetsC },
    })

    await act(async () => {
      const skipped = await result.current.updateView(null, datasetsC)
      expect(skipped).toBeNull()
    })

    await act(async () => {
      resolveReplayRun()
      await createPromise
    })

    expect(mockVegaView.data).toHaveBeenCalledWith("lookup", [{ id: "b" }])
    expect(mockVegaView.data).toHaveBeenCalledWith("lookup", [{ id: "c" }])
  })

  it("discards a superseded createView when the older embed resolves last", async () => {
    const embedResolvers: ((value: typeof mockEmbedReturn) => void)[] = []
    ;(embed as unknown as Mock).mockImplementation(
      () =>
        new Promise(resolve => {
          embedResolvers.push(resolve)
        })
    )

    const makeView = (): Mocked<VegaView> =>
      ({
        insert: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        runAsync: vi.fn().mockResolvedValue(null),
        data: vi.fn().mockReturnThis(),
        remove: vi.fn().mockReturnThis(),
        width: vi.fn().mockReturnThis(),
        height: vi.fn().mockReturnThis(),
      }) as unknown as Mocked<VegaView>

    const firstView = makeView()
    const secondView = makeView()
    const firstFinalize = vi.fn()
    const secondFinalize = vi.fn()

    const datasetsA = [
      {
        name: "lookup",
        hasName: true,
        data: { dimensions: { numDataRows: 1 }, hash: "a" },
      },
    ] as WrappedNamedDataset[]
    const datasetsB = [
      {
        name: "lookup",
        hasName: true,
        data: { dimensions: { numDataRows: 1 }, hash: "b" },
      },
    ] as WrappedNamedDataset[]

    const initialElement: VegaLiteChartElement = {
      id: "chartId",
      data: null,
      datasets: datasetsA,
      spec: "",
      useContainerWidth: false,
      vegaLiteTheme: "",
      selectionMode: [],
      formId: "",
    }

    const { result, rerender } = renderHook(
      ({ element }) => useVegaEmbed(element, mockWidgetMgr),
      { initialProps: { element: initialElement } }
    )

    ;(getInlineData as Mock).mockReturnValue(null)
    ;(getDataArrays as Mock).mockReturnValue({ lookup: [{ id: 1 }] })
    ;(getDataArray as Mock).mockImplementation((quiver: { hash?: string }) => [
      { id: quiver.hash },
    ])

    const containerRef = { current: document.createElement("div") }
    let firstPromise!: Promise<VegaView | null>
    act(() => {
      firstPromise = result.current.createView(containerRef, {})
    })

    rerender({
      element: { ...initialElement, datasets: datasetsB },
    })

    let secondPromise!: Promise<VegaView | null>
    act(() => {
      secondPromise = result.current.createView(containerRef, {})
    })

    await act(async () => {
      embedResolvers[1]({
        vgSpec: { data: [{}] },
        view: secondView,
        finalize: secondFinalize,
      })
      await secondPromise
    })

    await act(async () => {
      embedResolvers[0]({
        vgSpec: { data: [{}] },
        view: firstView,
        finalize: firstFinalize,
      })
      expect(await firstPromise).toBeNull()
    })

    expect(firstFinalize).toHaveBeenCalled()
    expect(firstView.data).not.toHaveBeenCalled()
    expect(firstView.insert).not.toHaveBeenCalled()
    expect(secondView.data).not.toHaveBeenCalled()
    expect(secondView.runAsync).toHaveBeenCalled()

    await act(async () => {
      const updated = await result.current.updateView(null, datasetsB)
      expect(updated).toBe(secondView)
    })
  })

  it("uses 'source' as default dataset name when no datasets but vgSpec.data present", async () => {
    const element: VegaLiteChartElement = {
      id: "chartId",
      data: null,
      datasets: [],
      spec: "",
      useContainerWidth: false,
      vegaLiteTheme: "",
      selectionMode: [],
      formId: "",
    }

    const { result } = renderHook(() => useVegaEmbed(element, mockWidgetMgr))

    const inline = [{ d: "inline" }]
    ;(getInlineData as Mock).mockReturnValue(inline)
    ;(getDataArrays as Mock).mockReturnValue(null)

    const containerRef = { current: document.createElement("div") }
    await act(async () => {
      await result.current.createView(containerRef, {})
    })

    // Inline insert should target the default 'source' dataset
    expect(mockVegaView.insert).toHaveBeenCalledWith("source", inline)
  })

  it("updateView removes stale named datasets not present in new input", async () => {
    const element: VegaLiteChartElement = {
      id: "chartId",
      data: null,
      datasets: [],
      spec: "",
      useContainerWidth: false,
      vegaLiteTheme: "",
      selectionMode: [],
      formId: "",
    }

    const { result } = renderHook(() => useVegaEmbed(element, mockWidgetMgr))

    const containerRef = { current: document.createElement("div") }
    await act(async () => {
      await result.current.createView(containerRef, {})
    })

    const dsOld = {
      name: "old",
      hasName: true,
      data: { dimensions: { numDataRows: 1 }, hash: "X" },
    } as WrappedNamedDataset
    ;(getDataArray as Mock).mockReturnValue([{ row: 1 }])

    // First update with 'old' dataset present
    await act(async () => {
      await result.current.updateView(null, [dsOld])
    })

    // Next update with no datasets; 'old' should be removed
    await act(async () => {
      await result.current.updateView(null, [])
    })

    expect(mockVegaView.remove).toHaveBeenCalledWith(
      "old",
      expect.any(Function)
    )
  })

  describe("resizeView", () => {
    it("returns false when view is not ready", async () => {
      const element: VegaLiteChartElement = {
        id: "chartId",
        data: null,
        datasets: [],
        spec: "",
        useContainerWidth: false,
        vegaLiteTheme: "",
        selectionMode: [],
        formId: "",
      }

      const { result } = renderHook(() => useVegaEmbed(element, mockWidgetMgr))

      // View hasn't been created yet
      const resizeResult = await result.current.resizeView(800, 600)
      expect(resizeResult).toBe(false)
    })

    it("calls view.width(), view.height(), and view.resize().runAsync() on resize", async () => {
      const element: VegaLiteChartElement = {
        id: "chartId",
        data: null,
        datasets: [],
        spec: "",
        useContainerWidth: false,
        vegaLiteTheme: "",
        selectionMode: [],
        formId: "",
      }

      const { result } = renderHook(() => useVegaEmbed(element, mockWidgetMgr))

      const containerRef = { current: document.createElement("div") }
      await act(async () => {
        await result.current.createView(containerRef, {})
      })

      // Clear mocks after createView to ensure we only assert resizeView calls
      mockVegaView.width.mockClear()
      mockVegaView.height.mockClear()
      mockVegaView.resize.mockClear()
      mockVegaView.runAsync.mockClear()

      // Now resize
      let resizeResult: boolean = false
      await act(async () => {
        resizeResult = await result.current.resizeView(800, 600)
      })

      expect(resizeResult).toBe(true)
      expect(mockVegaView.width).toHaveBeenCalledWith(800)
      expect(mockVegaView.height).toHaveBeenCalledWith(600)
      expect(mockVegaView.resize).toHaveBeenCalled()
    })

    it("skips width/height calls for non-positive values", async () => {
      const element: VegaLiteChartElement = {
        id: "chartId",
        data: null,
        datasets: [],
        spec: "",
        useContainerWidth: false,
        vegaLiteTheme: "",
        selectionMode: [],
        formId: "",
      }

      const { result } = renderHook(() => useVegaEmbed(element, mockWidgetMgr))

      const containerRef = { current: document.createElement("div") }
      await act(async () => {
        await result.current.createView(containerRef, {})
      })

      // Reset mocks
      mockVegaView.width.mockClear()
      mockVegaView.height.mockClear()

      // Resize with 0 values - should skip width/height calls
      await act(async () => {
        await result.current.resizeView(0, 0)
      })

      expect(mockVegaView.width).not.toHaveBeenCalled()
      expect(mockVegaView.height).not.toHaveBeenCalled()
      expect(mockVegaView.resize).toHaveBeenCalled()
    })

    it("returns false and logs warning when resize throws an error", async () => {
      const element: VegaLiteChartElement = {
        id: "chartId",
        data: null,
        datasets: [],
        spec: "",
        useContainerWidth: false,
        vegaLiteTheme: "",
        selectionMode: [],
        formId: "",
      }

      const { result } = renderHook(() => useVegaEmbed(element, mockWidgetMgr))

      const containerRef = { current: document.createElement("div") }
      await act(async () => {
        await result.current.createView(containerRef, {})
      })

      // Clear mocks after createView
      mockVegaView.width.mockClear()
      mockVegaView.height.mockClear()
      mockVegaView.resize.mockClear()
      mockVegaView.runAsync.mockClear()

      // Make resize throw an error
      const resizeError = new Error("Resize failed")
      mockVegaView.resize.mockImplementation(() => {
        throw resizeError
      })

      let resizeResult: boolean = true
      await act(async () => {
        resizeResult = await result.current.resizeView(800, 600)
      })

      // Verify resizeView catches the error and returns false
      expect(resizeResult).toBe(false)
      // The width was set before resize threw
      expect(mockVegaView.width).toHaveBeenCalledWith(800)
    })
  })

  describe("isViewReady", () => {
    it("is false before view is created", () => {
      const element: VegaLiteChartElement = {
        id: "chartId",
        data: null,
        datasets: [],
        spec: "",
        useContainerWidth: false,
        vegaLiteTheme: "",
        selectionMode: [],
        formId: "",
      }

      const { result } = renderHook(() => useVegaEmbed(element, mockWidgetMgr))

      expect(result.current.isViewReady).toBe(false)
    })

    it("is true after view is created", async () => {
      const element: VegaLiteChartElement = {
        id: "chartId",
        data: null,
        datasets: [],
        spec: "",
        useContainerWidth: false,
        vegaLiteTheme: "",
        selectionMode: [],
        formId: "",
      }

      const { result, rerender } = renderHook(() =>
        useVegaEmbed(element, mockWidgetMgr)
      )

      const containerRef = { current: document.createElement("div") }
      await act(async () => {
        await result.current.createView(containerRef, {})
      })

      // Force a re-render to pick up the state change from setIsCreatingView(false)
      rerender()

      expect(result.current.isViewReady).toBe(true)
    })
  })

  describe("exportToPng", () => {
    it("returns null if no vegaView is present", async () => {
      const element: VegaLiteChartElement = {
        id: "chartId",
        data: null,
        datasets: [],
        spec: "",
        useContainerWidth: false,
        vegaLiteTheme: "",
        selectionMode: [],
        formId: "",
      }

      const { result } = renderHook(() => useVegaEmbed(element, mockWidgetMgr))

      await expect(result.current.exportToPng()).resolves.toBeNull()
    })

    it("exports the vega view as a PNG with at least 2x scale", async () => {
      const element: VegaLiteChartElement = {
        id: "chartId",
        data: null,
        datasets: [],
        spec: "",
        useContainerWidth: false,
        vegaLiteTheme: "",
        selectionMode: [],
        formId: "",
      }

      const originalDpr = window.devicePixelRatio
      Object.defineProperty(window, "devicePixelRatio", {
        value: 1,
        configurable: true,
      })

      try {
        const { result } = renderHook(() =>
          useVegaEmbed(element, mockWidgetMgr)
        )

        const containerRef = { current: document.createElement("div") }
        await act(async () => {
          await result.current.createView(containerRef, {})
        })

        await expect(result.current.exportToPng()).resolves.toBe(
          "data:image/png;base64,mock"
        )
        expect(mockVegaView.toImageURL).toHaveBeenCalledWith("png", 2)
      } finally {
        Object.defineProperty(window, "devicePixelRatio", {
          value: originalDpr,
          configurable: true,
        })
      }
    })

    it("uses window.devicePixelRatio when it exceeds 2x", async () => {
      const element: VegaLiteChartElement = {
        id: "chartId",
        data: null,
        datasets: [],
        spec: "",
        useContainerWidth: false,
        vegaLiteTheme: "",
        selectionMode: [],
        formId: "",
      }

      const originalDpr = window.devicePixelRatio
      Object.defineProperty(window, "devicePixelRatio", {
        value: 3,
        configurable: true,
      })

      try {
        const { result } = renderHook(() =>
          useVegaEmbed(element, mockWidgetMgr)
        )

        const containerRef = { current: document.createElement("div") }
        await act(async () => {
          await result.current.createView(containerRef, {})
        })

        await result.current.exportToPng()
        expect(mockVegaView.toImageURL).toHaveBeenCalledWith("png", 3)
      } finally {
        Object.defineProperty(window, "devicePixelRatio", {
          value: originalDpr,
          configurable: true,
        })
      }
    })
  })
})
