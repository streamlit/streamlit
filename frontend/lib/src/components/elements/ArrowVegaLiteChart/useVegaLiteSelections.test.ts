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
import type { View as VegaView } from "vega"
import type { Mock, Mocked } from "vitest"

import type { WidgetStateManager } from "~lib/WidgetStateManager"

import type { VegaLiteChartElement } from "./arrowUtils"
import { useVegaLiteSelections } from "./useVegaLiteSelections"

const DEBOUNCE_TIME_MS = 150

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
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it("adds signal listeners for each selectionMode parameter", () => {
    const mockVegaView = {
      addSignalListener: vi.fn(),
      removeSignalListener: vi.fn(),
      getState: vi.fn(),
      container: vi.fn(() => null),
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
    act(() => result.current.teardownSelections())
  })

  it("does not attach listeners when no selections are configured", () => {
    const container = document.createElement("div")
    const containerListenerSpy = vi.spyOn(container, "addEventListener")
    const mockVegaView = {
      addSignalListener: vi.fn(),
      removeSignalListener: vi.fn(),
      container: vi.fn(() => container),
    } as unknown as Mocked<VegaView>

    const { result, unmount } = renderHook(() =>
      useVegaLiteSelections(
        {
          id: "chartId",
          data: null,
          datasets: [],
          spec: "",
          useContainerWidth: false,
          vegaLiteTheme: "",
          formId: "",
          selectionMode: [],
        },
        mockWidgetMgr
      )
    )
    const windowListenerSpy = vi.spyOn(window, "addEventListener")

    act(() => {
      result.current.maybeConfigureSelections(mockVegaView)
    })

    expect(mockVegaView.addSignalListener).not.toHaveBeenCalled()
    expect(containerListenerSpy).not.toHaveBeenCalled()
    expect(windowListenerSpy).not.toHaveBeenCalled()

    act(() => result.current.teardownSelections())
    windowListenerSpy.mockRestore()
    containerListenerSpy.mockRestore()
    unmount()
  })

  it("stores the vega viewState in the widget manager on signal fire", () => {
    const mockVegaView = {
      addSignalListener: vi.fn(),
      removeSignalListener: vi.fn(),
      getState: vi.fn(() => ({ some: "state" })),
      container: vi.fn(() => null),
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
    act(() => result.current.teardownSelections())
  })

  it("updates widget state with processed selection on signal fire", () => {
    const mockVegaView = {
      addSignalListener: vi.fn(),
      removeSignalListener: vi.fn(),
      getState: vi.fn(() => ({ some: "state" })),
      container: vi.fn(() => null),
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
      "chartId",
      JSON.stringify({
        selection: {
          param1: [{ data: "A" }, { data: "B" }],
        },
      }),
      { formId: "formId", fragmentId: undefined, fromUser: true } // fragmentId not passed in this test
    )
    act(() => result.current.teardownSelections())
  })

  it("does not update widget state if the state hasn't changed", () => {
    const mockVegaView = {
      addSignalListener: vi.fn(),
      removeSignalListener: vi.fn(),
      getState: vi.fn(() => ({ some: "state" })),
      container: vi.fn(() => null),
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
    act(() => result.current.teardownSelections())
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
      "chartId",
      JSON.stringify({
        selection: {
          param1: {},
          param2: {},
        },
      }),
      { formId: "formId", fragmentId: undefined, fromUser: true }
    )
  })

  describe("send timing and teardown", () => {
    const cleanups: Array<() => void> = []

    const dispatch = (
      target: EventTarget,
      eventType: string,
      pointerId = 1,
      buttons = 0,
      button = 0,
      isPrimary = true,
      relatedTarget: EventTarget | null = null
    ): void => {
      act(() => {
        const event = new Event(eventType, { bubbles: true })
        const eventTarget =
          eventType.startsWith("pointer") && target instanceof HTMLDivElement
            ? (target.querySelector("canvas") ?? target)
            : target
        if (eventType.startsWith("pointer")) {
          Object.defineProperty(event, "pointerId", { value: pointerId })
          Object.defineProperty(event, "buttons", { value: buttons })
          Object.defineProperty(event, "button", { value: button })
          Object.defineProperty(event, "isPrimary", { value: isPrimary })
          Object.defineProperty(event, "relatedTarget", {
            value: relatedTarget,
          })
        }
        eventTarget.dispatchEvent(event)
      })
    }

    const advanceTimers = (milliseconds: number): void => {
      act(() => {
        vi.advanceTimersByTime(milliseconds)
      })
    }

    const flushAsyncWork = async (): Promise<void> => {
      await act(async () => {
        await Promise.resolve()
      })
    }

    interface SetupResult {
      container: HTMLDivElement
      fire: (name: string, value: Record<string, unknown>) => void
      mockVegaView: Mocked<VegaView>
      teardown: () => void
    }

    const setup = ({
      formId = "",
      selectionMode = ["sel"],
    }: {
      formId?: string
      selectionMode?: string[]
    } = {}): SetupResult => {
      const container = document.createElement("div")
      container.appendChild(document.createElement("canvas"))
      document.body.appendChild(container)
      const signalListeners = new Map<
        string,
        (name: string, value: Record<string, unknown>) => void
      >()
      const mockVegaView = {
        addSignalListener: vi.fn(
          (
            name: string,
            listener: (name: string, value: Record<string, unknown>) => void
          ) => {
            signalListeners.set(name, listener)
          }
        ),
        removeSignalListener: vi.fn(),
        getState: vi.fn(() => ({ some: "state" })),
        setState: vi.fn().mockReturnThis(),
        container: vi.fn(() => container),
        runAsync: vi.fn(),
      } as unknown as Mocked<VegaView>
      mockVegaView.runAsync.mockResolvedValue(mockVegaView)

      let currentWidgetState = ""
      mockWidgetMgr.getStringValue.mockImplementation(() => currentWidgetState)
      mockWidgetMgr.setStringValue.mockImplementation((_id, value) => {
        currentWidgetState = value ?? ""
      })

      const { result, unmount } = renderHook(() =>
        useVegaLiteSelections(
          {
            id: "chartId",
            formId,
            selectionMode,
          } as VegaLiteChartElement,
          mockWidgetMgr
        )
      )
      act(() => {
        result.current.maybeConfigureSelections(mockVegaView)
      })

      const teardown = (): void => {
        act(() => result.current.teardownSelections())
      }
      cleanups.push(() => {
        teardown()
        unmount()
        container.remove()
      })

      return {
        container,
        fire: (name: string, value: Record<string, unknown>): void => {
          act(() => signalListeners.get(name)?.(name, value))
        },
        mockVegaView,
        teardown,
      }
    }

    const sentStates = (): Array<{
      selection: Record<string, unknown>
    }> =>
      mockWidgetMgr.setStringValue.mock.calls.map(([, value]) =>
        JSON.parse(value as string)
      )

    afterEach(() => {
      cleanups.splice(0).forEach(cleanup => cleanup())
    })

    it.each(["click", "dblclick", "keydown", "keyup"])(
      "sends a selection caused by %s immediately",
      eventType => {
        const { container, fire } = setup()

        dispatch(container, eventType)
        fire("sel", { value: eventType })

        expect(sentStates()).toEqual([
          { selection: { sel: { value: eventType } } },
        ])
      }
    )

    it("does not reuse a discrete event marker in a later task", () => {
      const { container, fire } = setup()
      dispatch(container, "click")
      fire("sel", { value: "click" })
      advanceTimers(0)
      mockWidgetMgr.setStringValue.mockClear()

      fire("sel", { value: "later" })
      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
      advanceTimers(DEBOUNCE_TIME_MS)

      expect(sentStates()).toEqual([
        { selection: { sel: { value: "later" } } },
      ])
    })

    it.each(["input", "textarea"])(
      "keeps %s binding key updates trailing-debounced",
      tagName => {
        const { container, fire } = setup()
        const textControl = document.createElement(tagName)
        container.appendChild(textControl)

        dispatch(textControl, "keydown")
        fire("sel", { value: "typed" })

        expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
        advanceTimers(DEBOUNCE_TIME_MS)
        expect(sentStates()).toEqual([
          { selection: { sel: { value: "typed" } } },
        ])
      }
    )

    it("handles a null selection signal", () => {
      const { container, fire } = setup()
      dispatch(container, "click")

      fire("sel", null as never)

      expect(sentStates()).toEqual([{ selection: { sel: {} } }])
    })

    it("does not hold signals from Vega binding controls", () => {
      const { container, fire } = setup()
      const select = document.createElement("select")
      container.appendChild(select)

      dispatch(select, "pointerdown")
      fire("sel", { value: "binding" })

      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
      advanceTimers(DEBOUNCE_TIME_MS)
      expect(sentStates()).toEqual([
        { selection: { sel: { value: "binding" } } },
      ])
    })

    it("does not hold pointermove signals from Vega binding controls", () => {
      const { container, fire } = setup()
      const range = document.createElement("input")
      range.type = "range"
      container.appendChild(range)

      dispatch(range, "pointermove", 1, 1)
      fire("sel", { value: "binding" })

      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
      advanceTimers(DEBOUNCE_TIME_MS)
      expect(sentStates()).toEqual([
        { selection: { sel: { value: "binding" } } },
      ])
    })

    it("does not hold signals from a secondary-button press", () => {
      const { container, fire } = setup()

      dispatch(container, "pointerdown", 1, 2, 2)
      fire("sel", { value: "context-menu" })

      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
      advanceTimers(DEBOUNCE_TIME_MS)
      expect(sentStates()).toEqual([
        { selection: { sel: { value: "context-menu" } } },
      ])
    })

    it("holds pointer updates and sends only the latest value on release", async () => {
      const { container, fire } = setup()
      dispatch(container, "pointerdown")
      fire("sel", { x: [0, 1] })
      fire("sel", { x: [0, 2] })
      advanceTimers(DEBOUNCE_TIME_MS * 2)
      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()

      dispatch(window, "pointerup")
      await flushAsyncWork()

      expect(sentStates()).toEqual([{ selection: { sel: { x: [0, 2] } } }])
    })

    it("holds pending debounced values when a pointer gesture starts", async () => {
      const { container, fire } = setup({
        selectionMode: ["hover", "brush"],
      })
      fire("hover", { value: "pending" })

      dispatch(container, "pointerdown")
      advanceTimers(DEBOUNCE_TIME_MS)
      fire("brush", { x: [0, 2] })

      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
      dispatch(window, "pointerup")
      await flushAsyncWork()

      expect(sentStates()).toEqual([
        {
          selection: {
            hover: { value: "pending" },
            brush: { x: [0, 2] },
          },
        },
      ])
    })

    it("uses an asynchronous release signal as the final value", async () => {
      const { container, fire, mockVegaView } = setup()
      dispatch(container, "pointerdown")
      fire("sel", { x: [0, 1] })
      mockVegaView.runAsync.mockImplementationOnce(
        async (): Promise<VegaView> => {
          await Promise.resolve()
          fire("sel", { x: [0, 3] })
          return mockVegaView
        }
      )

      dispatch(container, "pointerup")
      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
      await flushAsyncWork()

      expect(sentStates()).toEqual([{ selection: { sel: { x: [0, 3] } } }])
      expect(mockWidgetMgr.setStringValue).toHaveBeenCalledOnce()
    })

    it("flushes a drag released outside the chart", async () => {
      const { container, fire } = setup()
      const outside = document.createElement("div")
      document.body.appendChild(outside)
      dispatch(container, "pointerdown")
      fire("sel", { x: [1, 4] })

      dispatch(outside, "pointerup")
      await flushAsyncWork()

      expect(sentStates()).toEqual([{ selection: { sel: { x: [1, 4] } } }])
      outside.remove()
    })

    it("flushes when the active pointer leaves the document", async () => {
      const { container, fire } = setup()
      dispatch(container, "pointerdown")
      fire("sel", { x: [1, 4] })

      dispatch(window, "pointerout")
      await flushAsyncWork()

      expect(sentStates()).toEqual([{ selection: { sel: { x: [1, 4] } } }])
    })

    it("keeps holding when the pointer moves onto other page content", async () => {
      const { container, fire, mockVegaView } = setup()
      const outside = document.createElement("div")
      document.body.appendChild(outside)
      dispatch(container, "pointerdown")
      fire("sel", { x: [1, 4] })

      dispatch(container, "pointerout", 1, 0, 0, true, outside)
      await flushAsyncWork()

      expect(mockVegaView.runAsync).not.toHaveBeenCalled()
      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()

      dispatch(window, "pointerup")
      await flushAsyncWork()
      expect(sentStates()).toEqual([{ selection: { sel: { x: [1, 4] } } }])
      outside.remove()
    })

    it("settles queued signals when a pointer leaves and resumes if held", async () => {
      const { container, fire, mockVegaView } = setup()
      dispatch(container, "pointerdown")
      fire("sel", { x: [1, 4] })
      mockVegaView.runAsync.mockImplementationOnce(
        async (): Promise<VegaView> => {
          await Promise.resolve()
          fire("sel", { x: [1, 5] })
          return mockVegaView
        }
      )

      dispatch(container, "pointerout")
      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
      await flushAsyncWork()
      expect(sentStates()).toEqual([{ selection: { sel: { x: [1, 5] } } }])

      dispatch(container, "pointermove", 1, 1)
      fire("sel", { x: [1, 6] })
      expect(mockWidgetMgr.setStringValue).toHaveBeenCalledOnce()

      dispatch(window, "pointerup")
      await flushAsyncWork()
      expect(sentStates()).toEqual([
        { selection: { sel: { x: [1, 5] } } },
        { selection: { sel: { x: [1, 6] } } },
      ])
    })

    it("resumes a held pointer while pointerout processing is pending", async () => {
      const { container, fire, mockVegaView } = setup()
      let resolvePointerOutRun: ((view: VegaView) => void) | undefined
      mockVegaView.runAsync.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolvePointerOutRun = resolve
          })
      )
      dispatch(container, "pointerdown")
      fire("sel", { x: [1, 4] })
      dispatch(container, "pointerout")

      dispatch(container, "pointermove", 1, 1)
      fire("sel", { x: [1, 6] })
      await act(async () => {
        resolvePointerOutRun?.(mockVegaView)
        await Promise.resolve()
      })
      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()

      dispatch(window, "pointerup")
      await flushAsyncWork()
      expect(sentStates()).toEqual([{ selection: { sel: { x: [1, 6] } } }])
    })

    it("settles queued signals when the window loses focus", async () => {
      const { container, fire, mockVegaView } = setup()
      dispatch(container, "pointerdown")
      fire("sel", { x: [2, 6] })
      mockVegaView.runAsync.mockImplementationOnce(
        async (): Promise<VegaView> => {
          await Promise.resolve()
          fire("sel", { x: [2, 7] })
          return mockVegaView
        }
      )

      dispatch(window, "blur")
      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
      await flushAsyncWork()

      expect(sentStates()).toEqual([{ selection: { sel: { x: [2, 7] } } }])
    })

    it("flushes held values when a context menu opens", async () => {
      const { container, fire } = setup()
      dispatch(container, "pointerdown")
      fire("sel", { x: [2, 8] })

      dispatch(container, "contextmenu")
      await flushAsyncWork()

      expect(sentStates()).toEqual([{ selection: { sel: { x: [2, 8] } } }])
    })

    it("flushes held values on pointercancel", async () => {
      const { container, fire } = setup()
      dispatch(container, "pointerdown")
      fire("sel", { x: [2, 5] })

      dispatch(container, "pointercancel")
      await flushAsyncWork()

      expect(sentStates()).toEqual([{ selection: { sel: { x: [2, 5] } } }])
    })

    it("ignores releases from another pointer", async () => {
      const { container, fire, mockVegaView } = setup()
      dispatch(container, "pointerdown", 1)
      fire("sel", { x: [0, 1] })

      dispatch(window, "pointerup", 2)
      await flushAsyncWork()
      fire("sel", { x: [0, 2] })

      expect(mockVegaView.runAsync).not.toHaveBeenCalled()
      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()

      dispatch(window, "pointerup", 1)
      await flushAsyncWork()
      expect(sentStates()).toEqual([{ selection: { sel: { x: [0, 2] } } }])
    })

    it("does not let another pointer resume a settling gesture", async () => {
      const { container, fire, mockVegaView } = setup()
      let resolveRelease: ((view: VegaView) => void) | undefined
      mockVegaView.runAsync.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveRelease = resolve
          })
      )

      dispatch(container, "pointerdown", 1)
      fire("sel", { x: [0, 1] })
      dispatch(window, "pointerup", 1)
      dispatch(container, "pointermove", 2, 1)

      await act(async () => {
        resolveRelease?.(mockVegaView)
        await Promise.resolve()
      })

      expect(sentStates()).toEqual([{ selection: { sel: { x: [0, 1] } } }])
    })

    it("does not let an older release finish a newer gesture", async () => {
      const { container, fire, mockVegaView } = setup()
      let resolveFirstRelease: ((view: VegaView) => void) | undefined
      mockVegaView.runAsync.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveFirstRelease = resolve
          })
      )

      dispatch(container, "pointerdown", 1)
      fire("sel", { x: [0, 1] })
      dispatch(window, "pointerup", 1)

      dispatch(container, "pointerdown", 2)
      fire("sel", { x: [0, 2] })
      await act(async () => {
        resolveFirstRelease?.(mockVegaView)
        await Promise.resolve()
      })
      fire("sel", { x: [0, 3] })

      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
      dispatch(window, "pointerup", 2)
      await flushAsyncWork()

      expect(mockVegaView.runAsync).toHaveBeenCalledTimes(2)
      expect(sentStates()).toEqual([{ selection: { sel: { x: [0, 3] } } }])
    })

    it("flushes two held parameters in one widget update", async () => {
      const { container, fire } = setup({
        selectionMode: ["brush", "legend"],
      })
      dispatch(container, "pointerdown")
      fire("brush", { x: [0, 10] })
      fire("legend", { region: ["Europe"] })

      dispatch(window, "pointerup")
      await flushAsyncWork()

      expect(mockWidgetMgr.setStringValue).toHaveBeenCalledOnce()
      expect(sentStates()).toEqual([
        {
          selection: {
            brush: { x: [0, 10] },
            legend: { region: ["Europe"] },
          },
        },
      ])
    })

    it("does not flush again when teardown precedes release completion", async () => {
      const { container, fire, mockVegaView, teardown } = setup()
      let resolveReleaseRun: ((view: VegaView) => void) | undefined
      mockVegaView.runAsync.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveReleaseRun = resolve
          })
      )
      dispatch(container, "pointerdown")
      fire("sel", { x: [0, 4] })
      dispatch(window, "pointerup")

      teardown()
      expect(sentStates()).toEqual([{ selection: { sel: { x: [0, 4] } } }])

      await act(async () => {
        resolveReleaseRun?.(mockVegaView)
        await Promise.resolve()
      })
      expect(mockWidgetMgr.setStringValue).toHaveBeenCalledOnce()
    })

    it.each(["pointermove", "wheel"])(
      "keeps %s selection changes trailing-debounced",
      eventType => {
        const { container, fire } = setup()
        dispatch(container, eventType)
        fire("sel", { value: "first" })
        fire("sel", { value: "last" })

        advanceTimers(DEBOUNCE_TIME_MS - 1)
        expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
        advanceTimers(1)

        expect(sentStates()).toEqual([
          { selection: { sel: { value: "last" } } },
        ])
      }
    )

    it("cancels an older debounced value when a click sends a newer value", () => {
      const { container, fire } = setup()
      dispatch(container, "pointermove")
      fire("sel", { value: "hover" })
      dispatch(container, "click")
      fire("sel", { value: "click" })
      advanceTimers(DEBOUNCE_TIME_MS)

      expect(sentStates()).toEqual([
        { selection: { sel: { value: "click" } } },
      ])
    })

    it("sends every selection update immediately inside a form", () => {
      const { container, fire } = setup({ formId: "formId" })
      dispatch(container, "pointerdown")
      fire("sel", { x: [0, 1] })
      fire("sel", { x: [0, 2] })

      expect(sentStates()).toEqual([
        { selection: { sel: { x: [0, 1] } } },
        { selection: { sel: { x: [0, 2] } } },
      ])
    })

    it("flushes pending values and removes listeners on teardown", () => {
      const { container, fire, mockVegaView, teardown } = setup()
      const removeEventListenerSpy = vi.spyOn(container, "removeEventListener")
      dispatch(container, "pointerdown")
      fire("sel", { x: [0, 4] })

      teardown()
      teardown()

      expect(sentStates()).toEqual([{ selection: { sel: { x: [0, 4] } } }])
      expect(mockVegaView.removeSignalListener).toHaveBeenCalledOnce()
      expect(removeEventListenerSpy).toHaveBeenCalled()

      mockWidgetMgr.setStringValue.mockClear()
      dispatch(container, "pointerdown")
      fire("sel", { x: [0, 5] })
      advanceTimers(DEBOUNCE_TIME_MS)
      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
    })

    it("contains errors while flushing held values on teardown", () => {
      const { container, fire, mockVegaView, teardown } = setup()
      dispatch(container, "pointerdown")
      fire("sel", { x: [0, 4] })
      mockVegaView.getState.mockImplementationOnce(() => {
        throw new Error("invalid Vega state")
      })

      expect(teardown).not.toThrow()
      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
    })

    it("flushes and cancels a pending debounced value on teardown", () => {
      const { fire, teardown } = setup()
      fire("sel", { value: "pending" })

      teardown()
      expect(sentStates()).toEqual([
        { selection: { sel: { value: "pending" } } },
      ])

      advanceTimers(DEBOUNCE_TIME_MS)
      expect(mockWidgetMgr.setStringValue).toHaveBeenCalledOnce()
    })
  })
})
