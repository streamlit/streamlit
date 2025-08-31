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
import { Mock, Mocked } from "vitest"

import { debounce } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { VegaLiteChartElement } from "./arrowUtils"
import { useVegaLiteSelections } from "./useVegaLiteSelections"

// Mock the debounce so we can control how/when it is invoked.
vi.mock("~lib/util/utils", async () => ({
  // we will override the `debounce`
  ...(await vi.importActual("~lib/util/utils")),
  debounce: vi.fn(),
}))

describe("useVegaLiteSelections", () => {
  // Use a mocked version of the WidgetStateManager
  let mockWidgetMgr: Mocked<WidgetStateManager>

  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()

    mockWidgetMgr = {
      getElementState: vi.fn(),
      setElementState: vi.fn(),
      setStringValue: vi.fn(),
      getStringValue: vi.fn(),
      addFormClearedListener: vi.fn().mockReturnValue({ disconnect: vi.fn() }),
    } as unknown as Mocked<WidgetStateManager>

    const debouncedMock = debounce as Mock
    // By default, the mocked debounce simply calls its callback immediately.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    debouncedMock.mockImplementation((_delay: number, fn: any) => fn)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it("adds signal listeners for each selectionMode parameter", () => {
    const mockVegaView = {
      addSignalListener: vi.fn(),
      getState: vi.fn(),
    } as unknown as Mocked<VegaView>

    const selectionMode = ["param1", "param2"]
    const { result } = renderHook(() =>
      useVegaLiteSelections(
        {
          id: "chartId",
          formId: "formId",
          selectionMode,
        } as VegaLiteChartElement,
        mockWidgetMgr
      )
    )

    // Invoke the returned callback with our mock view
    act(() => {
      const { maybeConfigureSelections } = result.current
      maybeConfigureSelections(mockVegaView)
    })

    expect(mockVegaView.addSignalListener).toHaveBeenCalledTimes(
      selectionMode.length
    )
    selectionMode.forEach(param => {
      expect(mockVegaView.addSignalListener).toHaveBeenCalledWith(
        param,
        expect.any(Function)
      )
    })
  })

  it("stores the vega viewState in the widget manager on signal fire", () => {
    const mockVegaView = {
      addSignalListener: vi.fn(),
      getState: vi.fn(() => ({ some: "state" })),
    } as unknown as Mocked<VegaView>

    const selectionMode = ["param1"]
    const { result } = renderHook(() =>
      useVegaLiteSelections(
        {
          id: "chartId",
          formId: "formId",
          selectionMode,
        } as VegaLiteChartElement,
        mockWidgetMgr
      )
    )

    act(() => {
      const { maybeConfigureSelections } = result.current
      maybeConfigureSelections(mockVegaView)
    })

    // Retrieve the actual listener callback.
    // The first argument to addSignalListener is the param name,
    // the second argument is the callback function.
    const [[, listenerCallback]] = (mockVegaView.addSignalListener as Mock)
      .mock.calls

    // Simulate the signal callback
    const signalValue = { foo: "bar" }
    act(() => {
      listenerCallback("param1", signalValue)
    })

    // Expect setElementState to be called with the vegaView state
    expect(mockVegaView.getState).toHaveBeenCalled()
    expect(mockWidgetMgr.setElementState).toHaveBeenCalledWith(
      "chartId",
      "viewState",
      { some: "state" }
    )
  })

  it("updates widget state with processed selection on signal fire", () => {
    const mockVegaView = {
      addSignalListener: vi.fn(),
      getState: vi.fn(() => ({ some: "state" })),
    } as unknown as Mocked<VegaView>

    const selectionMode = ["param1"]
    const { result } = renderHook(() =>
      useVegaLiteSelections(
        {
          id: "chartId",
          formId: "formId",
          selectionMode,
        } as VegaLiteChartElement,
        mockWidgetMgr
      )
    )

    act(() => {
      const { maybeConfigureSelections } = result.current
      maybeConfigureSelections(mockVegaView)
    })

    const [[, listenerCallback]] = (mockVegaView.addSignalListener as Mock)
      .mock.calls

    const signalValue = {
      vlPoint: {
        or: [{ data: "A" }, { data: "B" }],
      },
    }

    // Suppose getStringValue returns an empty object initially
    mockWidgetMgr.getStringValue.mockReturnValueOnce("")

    act(() => {
      listenerCallback("param1", signalValue)
    })

    // The or array is assigned to the "param1" key
    expect(mockWidgetMgr.setStringValue).toHaveBeenCalledWith(
      { id: "chartId", formId: "formId" },
      JSON.stringify({
        selection: {
          param1: [{ data: "A" }, { data: "B" }],
        },
      }),
      { fromUi: true },
      undefined // fragmentId not passed in this test
    )
  })

  it("does not update widget state if the state hasn't changed", () => {
    const mockVegaView = {
      addSignalListener: vi.fn(),
      getState: vi.fn(() => ({ some: "state" })),
    } as unknown as Mocked<VegaView>

    const selectionMode = ["param1"]
    const { result } = renderHook(() =>
      useVegaLiteSelections(
        {
          id: "chartId",
          formId: "formId",
          selectionMode,
        } as VegaLiteChartElement,
        mockWidgetMgr
      )
    )

    act(() => {
      const { maybeConfigureSelections } = result.current
      maybeConfigureSelections(mockVegaView)
    })

    const [[, listenerCallback]] = (mockVegaView.addSignalListener as Mock)
      .mock.calls

    // The widget is already set to the same updated state
    const existingState = {
      selection: {
        param1: [{ data: "A" }, { data: "B" }],
      },
    }
    mockWidgetMgr.getStringValue.mockReturnValueOnce(
      JSON.stringify(existingState)
    )

    // Fire the signal with the same selection
    act(() => {
      listenerCallback("param1", {
        vlPoint: {
          or: [{ data: "A" }, { data: "B" }],
        },
      })
    })

    expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
  })

  it("resets selection state when form is cleared", () => {
    const selectionMode = ["param1", "param2"]
    const { result } = renderHook(() =>
      useVegaLiteSelections(
        {
          id: "chartId",
          formId: "formId",
          selectionMode,
        } as VegaLiteChartElement,
        mockWidgetMgr
      )
    )

    const { onFormCleared } = result.current

    // Assume current state is not empty
    const existingState = {
      selection: {
        param1: [{ data: "X" }],
        param2: [{ data: "Y" }],
      },
    }
    mockWidgetMgr.getStringValue.mockReturnValueOnce(
      JSON.stringify(existingState)
    )

    act(() => {
      onFormCleared()
    })

    // Expect empty selection state
    expect(mockWidgetMgr.setStringValue).toHaveBeenCalledWith(
      { id: "chartId", formId: "formId" },
      JSON.stringify({
        selection: {
          param1: {},
          param2: {},
        },
      }),
      { fromUi: true },
      undefined
    )
  })
})
