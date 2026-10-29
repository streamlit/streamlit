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
import { getLogger } from "loglevel"
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
      deleteElementState: vi.fn(),
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
    expect(mockWidgetMgr.deleteElementState).toHaveBeenCalledWith(
      "chartId",
      "viewState"
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

  describe("interval view state capture and restore", () => {
    const cleanups: Array<() => void> = []

    const BRUSH_SIGNALS: Record<string, unknown> = {
      brush: {},
      brush_x: [10, 80],
      brush_y: [20, 90],
      brush_Horsepower: [80, 150],
      brush_Miles_per_Gallon: [15, 30],
      brush_tuple: {},
      brush_tuple_fields: [],
      brush_scale_trigger: {},
      brush_modify: {},
      brush_translate_anchor: {},
      brush_translate_delta: {},
      brush_zoom_anchor: {},
      brush_zoom_delta: {},
      unit: {},
    }

    const createIntervalView = ({
      presentSignals = BRUSH_SIGNALS,
      getStateResult = { some: "state" },
    }: {
      presentSignals?: Record<string, unknown>
      getStateResult?: unknown
    } = {}): Mocked<VegaView> =>
      ({
        addSignalListener: vi.fn().mockReturnThis(),
        removeSignalListener: vi.fn().mockReturnThis(),
        getState: vi.fn(() => getStateResult),
        setState: vi.fn().mockReturnThis(),
        container: vi.fn(() => null),
        scale: vi.fn((channel: string) => {
          if (channel === "x" || channel === "y") {
            return { type: "linear" }
          }
          throw new Error(`Unrecognized scale: "${channel}"`)
        }),
        signal: vi.fn((name: string) => {
          if (!Object.hasOwn(presentSignals, name)) {
            throw new Error(`Unrecognized signal name: "${name}"`)
          }
          return presentSignals[name]
        }),
      }) as unknown as Mocked<VegaView>

    const configure = (
      view: Mocked<VegaView>,
      {
        selectionMode = ["brush"],
        formId = "formId",
      }: { selectionMode?: string[]; formId?: string } = {}
    ): { current: ReturnType<typeof useVegaLiteSelections> } => {
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
        result.current.maybeConfigureSelections(view)
      })
      cleanups.push(() => {
        act(() => result.current.teardownSelections())
        unmount()
      })
      return result
    }

    const fireFirstListener = (
      view: Mocked<VegaView>,
      value: unknown = { Horsepower: [80, 150] }
    ): void => {
      const [[param, listener]] = (view.addSignalListener as Mock).mock.calls
      act(() => {
        listener(param, value)
      })
    }

    const getStateOptions = (
      view: Mocked<VegaView>
    ): {
      data: (name?: string) => boolean
      signals: (name?: string) => boolean
      recurse: boolean
    } => {
      fireFirstListener(view)
      return (view.getState as Mock).mock.calls[0][0] as {
        data: (name?: string) => boolean
        signals: (name?: string) => boolean
        recurse: boolean
      }
    }

    afterEach(() => {
      cleanups.splice(0).forEach(cleanup => cleanup())
    })

    it("captures 2D visual and data-space extents and skips transients", () => {
      const view = createIntervalView()
      configure(view)
      const { data, signals, recurse } = getStateOptions(view)

      expect(signals("brush_x")).toBe(true)
      expect(signals("brush_y")).toBe(true)
      expect(signals("brush_Horsepower")).toBe(true)
      expect(signals("brush_Miles_per_Gallon")).toBe(true)
      expect(signals("brush")).toBe(false)
      expect(signals("brush_tuple")).toBe(false)
      expect(signals("brush_translate_anchor")).toBe(false)
      expect(signals("brush_zoom_delta")).toBe(false)
      expect(signals("brush_scale_trigger")).toBe(false)
      expect(signals("brush_modify")).toBe(false)
      expect(signals("unit")).toBe(false)
      expect(data("brush_store")).toBe(true)
      expect(data("source_0")).toBe(false)
      expect(recurse).toBe(false)
    })

    it.each([
      {
        axis: "x",
        selectionMode: ["xbrush"],
        presentSignals: {
          xbrush_x: [10, 80],
          xbrush_Horsepower: [80, 150],
          xbrush_tuple: {},
        },
        kept: ["xbrush_x", "xbrush_Horsepower"],
        dropped: "xbrush_y",
      },
      {
        axis: "y",
        selectionMode: ["ybrush"],
        presentSignals: {
          ybrush_y: [20, 90],
          ybrush_Miles_per_Gallon: [15, 30],
        },
        kept: ["ybrush_y", "ybrush_Miles_per_Gallon"],
        dropped: "ybrush_x",
      },
    ])(
      "captures $axis-only extents and rejects a missing opposite-axis signal",
      ({ selectionMode, presentSignals, kept, dropped }) => {
        const view = createIntervalView({ presentSignals })
        configure(view, { selectionMode })
        const { signals } = getStateOptions(view)

        kept.forEach(name => expect(signals(name)).toBe(true))
        expect(signals(dropped)).toBe(false)
      }
    )

    it("does not persist extents when an interval channel uses a band scale", () => {
      const view = createIntervalView()
      view.scale.mockImplementation((channel: string) => {
        if (channel === "x") {
          return { type: "band" }
        }
        if (channel === "y") {
          return { type: "linear" }
        }
        throw new Error(`Unrecognized scale: "${channel}"`)
      })
      configure(view)
      const { signals, data } = getStateOptions(view)

      expect(signals("brush_x")).toBe(false)
      expect(signals("brush_y")).toBe(false)
      expect(signals("brush_Horsepower")).toBe(false)
      expect(data("brush_store")).toBe(true)
    })

    it("matches the longest param prefix so nested names stay distinct", () => {
      const view = createIntervalView({
        presentSignals: {
          brush_x: [10, 80],
          brush_Horsepower: [80, 150],
          brush_point_x: [12, 40],
          brush_point_tuple: {},
        },
      })
      configure(view, { selectionMode: ["brush", "brush_point"] })
      const { signals } = getStateOptions(view)

      expect(signals("brush_x")).toBe(true)
      expect(signals("brush_point_x")).toBe(true)
      expect(signals("brush_point_tuple")).toBe(false)
    })

    it("persists data-space extents whose field names look like transients", () => {
      const view = createIntervalView({
        presentSignals: {
          brush_x: [10, 80],
          brush_release_init: ["a", "b"],
        },
      })
      configure(view)
      const { signals } = getStateOptions(view)

      expect(signals("brush_x")).toBe(true)
      expect(signals("brush_release_init")).toBe(true)
    })

    it("captures extents for multiple interval params on one view", () => {
      const view = createIntervalView({
        presentSignals: {
          xsel_x: [10, 80],
          xsel_Horsepower: [80, 150],
          ysel_y: [20, 90],
          ysel_Miles_per_Gallon: [15, 30],
        },
      })
      configure(view, { selectionMode: ["xsel", "ysel"] })
      const { signals, data } = getStateOptions(view)

      expect(signals("xsel_x")).toBe(true)
      expect(signals("ysel_y")).toBe(true)
      expect(data("xsel_store")).toBe(true)
      expect(data("ysel_store")).toBe(true)
    })

    it("does not persist signals for point selections", () => {
      const view = createIntervalView({
        presentSignals: {
          pts: {},
          pts_tuple: {},
          pts_toggle: {},
          pts_modify: {},
        },
        getStateResult: { data: { pts_store: [{ values: [1] }] } },
      })
      configure(view, { selectionMode: ["pts"] })
      const { signals, data } = getStateOptions(view)

      expect(signals("pts")).toBe(false)
      expect(signals("pts_tuple")).toBe(false)
      expect(signals("pts_toggle")).toBe(false)
      expect(signals("pts_modify")).toBe(false)
      expect(signals("pts_x")).toBe(false)
      expect(data("pts_store")).toBe(true)
      expect(mockWidgetMgr.setElementState).toHaveBeenCalledWith(
        "chartId",
        "viewState",
        { data: { pts_store: [{ values: [1] }] } }
      )
    })

    it("restores signals and data without writing the widget value", () => {
      const restoredState = {
        signals: {
          brush_x: [10, 80],
          brush_y: [20, 90],
          brush_Horsepower: [80, 150],
        },
        data: { brush_store: [{ values: [1] }] },
      }
      mockWidgetMgr.getElementState.mockReturnValue(restoredState)
      const view = createIntervalView()
      configure(view)

      expect(view.setState).toHaveBeenCalledWith(restoredState)
      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
    })

    it("suppresses restore-triggered listeners until endSelectionRestore", () => {
      const restoredState = {
        signals: { brush_x: [10, 80] },
        data: { brush_store: [{ values: [1] }] },
      }
      mockWidgetMgr.getElementState.mockReturnValue(restoredState)
      mockWidgetMgr.getStringValue.mockReturnValue("")

      const view = createIntervalView()
      view.addSignalListener.mockImplementation(
        (
          _name: string,
          listener: (name: string, value: unknown) => void
        ): VegaView => {
          view.setState.mockImplementation((): VegaView => {
            listener("brush", { Horsepower: [80, 150] })
            return view
          })
          return view
        }
      )

      const result = configure(view)
      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()

      act(() => {
        result.current.endSelectionRestore()
      })
      fireFirstListener(view, { Horsepower: [80, 150] })
      expect(mockWidgetMgr.setStringValue).toHaveBeenCalledWith(
        "chartId",
        JSON.stringify({
          selection: { brush: { Horsepower: [80, 150] } },
        }),
        { formId: "formId", fragmentId: undefined, fromUser: true }
      )

      mockWidgetMgr.setStringValue.mockClear()
      mockWidgetMgr.getStringValue.mockReturnValue(
        JSON.stringify({
          selection: { brush: { Horsepower: [80, 150] } },
        })
      )
      fireFirstListener(view, { Horsepower: [80, 150] })
      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
    })

    it("captures empty extents on clear and restores that snapshot", () => {
      const emptyState = {
        signals: { brush_x: [0, 0], brush_Horsepower: null },
        data: { brush_store: [] },
      }
      const view = createIntervalView({ getStateResult: emptyState })
      configure(view)
      fireFirstListener(view, null)

      expect(mockWidgetMgr.setElementState).toHaveBeenCalledWith(
        "chartId",
        "viewState",
        emptyState
      )

      mockWidgetMgr.getElementState.mockReturnValue(emptyState)
      const restoreView = createIntervalView()
      configure(restoreView)
      expect(restoreView.setState).toHaveBeenCalledWith(emptyState)
    })

    it("drops incompatible signal keys and still restores store data", () => {
      mockWidgetMgr.getElementState.mockReturnValue({
        signals: {
          brush_x: [10, 80],
          brush_y: [20, 90],
          stale_y: [1, 2],
          param_1_y: [3, 4],
        },
        data: { brush_store: [{ values: [1] }] },
      })
      const view = createIntervalView({
        presentSignals: {
          brush_x: [10, 80],
        },
      })
      configure(view)

      expect(view.setState).toHaveBeenCalledWith({
        signals: { brush_x: [10, 80] },
        data: { brush_store: [{ values: [1] }] },
      })
    })

    it("drops transient snapshot signals even when the view still defines them", () => {
      mockWidgetMgr.getElementState.mockReturnValue({
        signals: {
          brush_x: [10, 80],
          brush_tuple: {},
          brush_scale_trigger: {},
          brush_translate_anchor: { x: 1, y: 2 },
        },
        data: {
          brush_store: [{ values: [1] }],
          extra_store: [{ values: [2] }],
        },
      })
      const view = createIntervalView({
        presentSignals: {
          brush_x: [10, 80],
          brush_tuple: {},
          brush_scale_trigger: {},
          brush_translate_anchor: { x: 1, y: 2 },
        },
      })
      configure(view)

      expect(view.setState).toHaveBeenCalledWith({
        signals: { brush_x: [10, 80] },
        data: { brush_store: [{ values: [1] }] },
      })
    })

    it("restores a data-space field whose name looks like a transient suffix", () => {
      mockWidgetMgr.getElementState.mockReturnValue({
        signals: {
          brush_x: [10, 80],
          brush_release_init: ["a", "b"],
        },
        data: { brush_store: [{ values: [1] }] },
      })
      const view = createIntervalView({
        presentSignals: {
          brush_x: [10, 80],
          brush_release_init: ["a", "b"],
        },
      })
      configure(view)

      expect(view.setState).toHaveBeenCalledWith({
        signals: {
          brush_x: [10, 80],
          brush_release_init: ["a", "b"],
        },
        data: { brush_store: [{ values: [1] }] },
      })
    })

    it("restores data only when no persisted interval signals exist", () => {
      mockWidgetMgr.getElementState.mockReturnValue({
        signals: { param_1_y: [20, 90] },
        data: {
          brush_store: [{ values: [1] }],
          pts_store: [{ values: [2] }],
        },
      })
      const view = createIntervalView({
        presentSignals: { pts_tuple: {} },
      })
      configure(view, { selectionMode: ["pts"] })

      expect(view.setState).toHaveBeenCalledWith({
        data: { pts_store: [{ values: [2] }] },
      })
    })

    it("warns and deletes viewState when setState throws", () => {
      const log = getLogger("useVegaLiteSelections")
      const warnSpy = vi.spyOn(log, "warn").mockImplementation(() => {})
      mockWidgetMgr.getElementState.mockReturnValue({
        signals: { brush_x: [10, 80] },
        data: { brush_store: [] },
      })
      const view = createIntervalView()
      view.setState.mockImplementation(() => {
        throw new Error("incompatible state")
      })

      configure(view)

      expect(warnSpy).toHaveBeenCalled()
      expect(mockWidgetMgr.deleteElementState).toHaveBeenCalledWith(
        "chartId",
        "viewState"
      )
      warnSpy.mockRestore()
    })

    it("restores legacy snapshots that have only data", () => {
      const legacyState = { data: { brush_store: [{ values: [1] }] } }
      mockWidgetMgr.getElementState.mockReturnValue(legacyState)
      const view = createIntervalView()
      configure(view)

      expect(view.setState).toHaveBeenCalledWith(legacyState)
      expect(mockWidgetMgr.setStringValue).not.toHaveBeenCalled()
    })
  })
})
