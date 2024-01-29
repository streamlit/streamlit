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

import {
  ComponentInstance as ComponentInstanceProto,
  SpecialArg,
} from "@streamlit/lib/src/proto"
import "@testing-library/jest-dom"
import { screen, fireEvent } from "@testing-library/react"
import {
  DEFAULT_IFRAME_FEATURE_POLICY,
  DEFAULT_IFRAME_SANDBOX_POLICY,
} from "@streamlit/lib/src/util/IFrameUtil"
import { logWarning } from "@streamlit/lib/src/util/log"
import { buildHttpUri } from "@streamlit/lib/src/util/UriUtil"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import React from "react"
import { bgColorToBaseString, toExportedTheme } from "@streamlit/lib/src/theme"
import { fonts } from "@streamlit/lib/src/theme/primitives/typography"
import { mockEndpoints } from "@streamlit/lib/src/mocks/mocks"
import { mockTheme } from "@streamlit/lib/src/mocks/mockTheme"
import {
  COMPONENT_READY_WARNING_TIME_MS,
  ComponentInstance,
  CUSTOM_COMPONENT_API_VERSION,
} from "./ComponentInstance"
import { ComponentRegistry } from "./ComponentRegistry"
import { ComponentMessageType, StreamlitMessageType } from "./enums"
import { render } from "@streamlit/lib/src/test_util"

// Mock log functions.
jest.mock("@streamlit/lib/src/util/log")

// We have some timeouts that we want to use fake timers for.
jest.useFakeTimers()

// Mock uri utils.
jest.mock("@streamlit/lib/src/util/UriUtil")
const mockedBuildHttpUri = buildHttpUri as jest.Mock
mockedBuildHttpUri.mockImplementation(() => "registry/url")

// Mock our WidgetStateManager
jest.mock("@streamlit/lib/src/WidgetStateManager")

const MOCK_COMPONENT_URL = "http://a.mock.url"
const MOCK_WIDGET_ID = "mock_widget_id"
const MOCK_COMPONENT_NAME = "mock_component_name"

describe("ComponentInstance", () => {
  const getComponentRegistry = (): ComponentRegistry => {
    return new ComponentRegistry(mockEndpoints())
  }

  beforeEach(() => {
    // Clear our class mocks
    const mockWidgetStateManager = WidgetStateManager as unknown as jest.Mock
    mockWidgetStateManager.mockClear()

    const mockLog = logWarning as jest.Mock
    mockLog.mockClear()
  })

  it("registers a message listener on render", () => {
    const componentRegistry = getComponentRegistry()
    const registerListener = jest.spyOn(componentRegistry, "registerListener")
    render(
      <ComponentInstance
        element={createElementProp()}
        registry={componentRegistry}
        width={100}
        disabled={false}
        theme={mockTheme.emotion}
        widgetMgr={
          new WidgetStateManager({
            sendRerunBackMsg: jest.fn(),
            formsDataChanged: jest.fn(),
          })
        }
      />
    )
    expect(registerListener).toHaveBeenCalledTimes(1)
  })

  it("deregisters its message listener on rerender", () => {
    const componentRegistry = getComponentRegistry()
    const deregisterListener = jest.spyOn(
      componentRegistry,
      "deregisterListener"
    )
    const { unmount } = render(
      <ComponentInstance
        element={createElementProp()}
        registry={componentRegistry}
        width={100}
        disabled={false}
        theme={mockTheme.emotion}
        widgetMgr={
          new WidgetStateManager({
            sendRerunBackMsg: jest.fn(),
            formsDataChanged: jest.fn(),
          })
        }
      />
    )
    unmount()
    expect(deregisterListener).toHaveBeenCalledTimes(1)
  })

  it("renders its iframe correctly", () => {
    const componentRegistry = getComponentRegistry()
    render(
      <ComponentInstance
        element={createElementProp()}
        registry={componentRegistry}
        width={100}
        disabled={false}
        theme={mockTheme.emotion}
        widgetMgr={
          new WidgetStateManager({
            sendRerunBackMsg: jest.fn(),
            formsDataChanged: jest.fn(),
          })
        }
      />
    )
    const iframe = screen.getByTitle(MOCK_COMPONENT_NAME)
    expect(iframe).toHaveAttribute(
      "src",
      "http://a.mock.url?streamlitUrl=http%3A%2F%2Flocalhost%2F"
    )
    expect(iframe).toHaveAttribute("allow", DEFAULT_IFRAME_FEATURE_POLICY)
    expect(iframe).toHaveAttribute("sandbox", DEFAULT_IFRAME_SANDBOX_POLICY)
  })

  describe("COMPONENT_READY handler", () => {
    it("posts a RENDER message to the iframe", () => {
      const jsonArgs = { foo: "string", bar: 5 }
      const componentRegistry = getComponentRegistry()
      render(
        <ComponentInstance
          element={createElementProp(jsonArgs)}
          registry={componentRegistry}
          width={100}
          disabled={false}
          theme={mockTheme.emotion}
          widgetMgr={
            new WidgetStateManager({
              sendRerunBackMsg: jest.fn(),
              formsDataChanged: jest.fn(),
            })
          }
        />
      )
      const iframe = screen.getByTitle(MOCK_COMPONENT_NAME)
      // @ts-expect-error
      const postMessage = jest.spyOn(iframe.contentWindow, "postMessage")
      // SET COMPONENT_READY
      fireEvent(
        window,
        new MessageEvent("message", {
          data: {
            isStreamlitMessage: true,
            apiVersion: 1,
            type: ComponentMessageType.COMPONENT_READY,
          },
          // @ts-expect-error
          source: iframe.contentWindow,
        })
      )
      expect(postMessage).toHaveBeenCalledWith(renderMsg(jsonArgs, []), "*")
    })

    it("prevents RENDER message until component is ready", () => {
      const jsonArgs = { foo: "string", bar: 5 }
      const componentRegistry = getComponentRegistry()
      render(
        <ComponentInstance
          element={createElementProp(jsonArgs)}
          registry={componentRegistry}
          width={100}
          disabled={false}
          theme={mockTheme.emotion}
          widgetMgr={
            new WidgetStateManager({
              sendRerunBackMsg: jest.fn(),
              formsDataChanged: jest.fn(),
            })
          }
        />
      )
      const iframe = screen.getByTitle(MOCK_COMPONENT_NAME)
      // @ts-expect-error
      const postMessage = jest.spyOn(iframe.contentWindow, "postMessage")
      expect(postMessage).toHaveBeenCalledTimes(0)
    })

    it("can be called multiple times", () => {
      // It's not an error for a component to call READY multiple times.
      // (This can happen during development, when the component's devserver
      // reloads.)
      const jsonArgs = { foo: "string", bar: 5 }
      const componentRegistry = getComponentRegistry()
      render(
        <ComponentInstance
          element={createElementProp(jsonArgs)}
          registry={componentRegistry}
          width={100}
          disabled={false}
          theme={mockTheme.emotion}
          widgetMgr={
            new WidgetStateManager({
              sendRerunBackMsg: jest.fn(),
              formsDataChanged: jest.fn(),
            })
          }
        />
      )
      const iframe = screen.getByTitle(MOCK_COMPONENT_NAME)
      // @ts-expect-error
      const postMessage = jest.spyOn(iframe.contentWindow, "postMessage")
      // SET COMPONENT_READY
      fireEvent(
        window,
        new MessageEvent("message", {
          data: {
            isStreamlitMessage: true,
            apiVersion: 1,
            type: ComponentMessageType.COMPONENT_READY,
          },
          // @ts-expect-error
          source: iframe.contentWindow,
        })
      )
      // SET COMPONENT_READY
      fireEvent(
        window,
        new MessageEvent("message", {
          data: {
            isStreamlitMessage: true,
            apiVersion: 1,
            type: ComponentMessageType.COMPONENT_READY,
          },
          // @ts-expect-error
          source: iframe.contentWindow,
        })
      )
      expect(postMessage).toHaveBeenCalledTimes(2)
    })

    it("errors on unrecognized API version", () => {
      const badAPIVersion = CUSTOM_COMPONENT_API_VERSION + 1
      const jsonArgs = { foo: "string", bar: 5 }
      const componentRegistry = getComponentRegistry()
      render(
        <ComponentInstance
          element={createElementProp(jsonArgs)}
          registry={componentRegistry}
          width={100}
          disabled={false}
          theme={mockTheme.emotion}
          widgetMgr={
            new WidgetStateManager({
              sendRerunBackMsg: jest.fn(),
              formsDataChanged: jest.fn(),
            })
          }
        />
      )
      const iframe = screen.getByTitle(MOCK_COMPONENT_NAME)
      // SET COMPONENT_READY
      fireEvent(
        window,
        new MessageEvent("message", {
          data: {
            isStreamlitMessage: true,
            apiVersion: badAPIVersion,
            type: ComponentMessageType.COMPONENT_READY,
          },
          // @ts-expect-error
          source: iframe.contentWindow,
        })
      )
      expect(screen.getByTestId("stNotificationContentError")).toBeVisible()
    })

    it("errors on unrecognized special args", () => {
      const jsonArgs = {}
      const element = createElementProp(jsonArgs, [
        new SpecialArg({ key: "foo" }),
      ])
      const componentRegistry = getComponentRegistry()
      render(
        <ComponentInstance
          element={element}
          registry={componentRegistry}
          width={100}
          disabled={false}
          theme={mockTheme.emotion}
          widgetMgr={
            new WidgetStateManager({
              sendRerunBackMsg: jest.fn(),
              formsDataChanged: jest.fn(),
            })
          }
        />
      )
      expect(
        screen.getByText("Unrecognized SpecialArg type: undefined")
      ).toBeVisible()
    })

    it("warns if COMPONENT_READY hasn't been received after a timeout", () => {
      const componentRegistry = getComponentRegistry()
      const { rerender } = render(
        <ComponentInstance
          element={createElementProp()}
          registry={componentRegistry}
          width={100}
          disabled={false}
          theme={mockTheme.emotion}
          widgetMgr={
            new WidgetStateManager({
              sendRerunBackMsg: jest.fn(),
              formsDataChanged: jest.fn(),
            })
          }
        />
      )
      // Advance past our warning timeout, and force a re-render.
      jest.advanceTimersByTime(COMPONENT_READY_WARNING_TIME_MS)

      rerender(
        <ComponentInstance
          element={createElementProp()}
          registry={componentRegistry}
          width={100}
          disabled={false}
          theme={mockTheme.emotion}
          widgetMgr={
            new WidgetStateManager({
              sendRerunBackMsg: jest.fn(),
              formsDataChanged: jest.fn(),
            })
          }
        />
      )
      expect(
        screen.getByText(/The app is attempting to load the component from/)
      ).toBeVisible()
    })
  })

  describe("SET_COMPONENT_VALUE handler", () => {
    it("handles JSON values", () => {
      const jsonValue = {
        foo: "string",
        bar: 123,
        list: [1, "foo", false],
      }

      const componentRegistry = getComponentRegistry()
      const element = createElementProp(jsonValue)
      render(
        <ComponentInstance
          element={element}
          registry={componentRegistry}
          width={100}
          disabled={false}
          theme={mockTheme.emotion}
          widgetMgr={
            new WidgetStateManager({
              sendRerunBackMsg: jest.fn(),
              formsDataChanged: jest.fn(),
            })
          }
        />
      )

      const iframe = screen.getByTitle(MOCK_COMPONENT_NAME)
      // SET COMPONENT_READY
      fireEvent(
        window,
        new MessageEvent("message", {
          data: {
            isStreamlitMessage: true,
            apiVersion: 1,
            type: ComponentMessageType.COMPONENT_READY,
          },
          // @ts-expect-error
          source: iframe.contentWindow,
        })
      )
      // SET COMPONENT_VALUE
      fireEvent(
        window,
        new MessageEvent("message", {
          data: {
            isStreamlitMessage: true,
            apiVersion: 1,
            type: ComponentMessageType.SET_COMPONENT_VALUE,
            dataType: "json",
            value: jsonValue,
          },
          // @ts-expect-error
          source: iframe.contentWindow,
        })
      )
      const widgetMgr = (WidgetStateManager as any).mock.instances[0]
      expect(widgetMgr.setJsonValue).toHaveBeenCalledWith(element, jsonValue, {
        fromUi: true,
      })
    })

    it("handles bytes values", () => {
      const jsonValue = {}

      const componentRegistry = getComponentRegistry()
      const element = createElementProp(jsonValue)
      render(
        <ComponentInstance
          element={element}
          registry={componentRegistry}
          width={100}
          disabled={false}
          theme={mockTheme.emotion}
          widgetMgr={
            new WidgetStateManager({
              sendRerunBackMsg: jest.fn(),
              formsDataChanged: jest.fn(),
            })
          }
        />
      )

      const iframe = screen.getByTitle(MOCK_COMPONENT_NAME)
      // SET COMPONENT_READY
      fireEvent(
        window,
        new MessageEvent("message", {
          data: {
            isStreamlitMessage: true,
            apiVersion: 1,
            type: ComponentMessageType.COMPONENT_READY,
          },
          // @ts-expect-error
          source: iframe.contentWindow,
        })
      )

      const bytesValue = new Uint8Array([0, 1, 2])
      // SET COMPONENT_VALUE
      fireEvent(
        window,
        new MessageEvent("message", {
          data: {
            isStreamlitMessage: true,
            apiVersion: 1,
            type: ComponentMessageType.SET_COMPONENT_VALUE,
            dataType: "bytes",
            value: bytesValue,
          },
          // @ts-expect-error
          source: iframe.contentWindow,
        })
      )
      const widgetMgr = (WidgetStateManager as any).mock.instances[0]
      expect(widgetMgr.setBytesValue).toHaveBeenCalledWith(
        element,
        bytesValue,
        { fromUi: true }
      )
    })

    //   // TODO: implement test to check handling of daataframe values

    it("warns if called before COMPONENT_READY", () => {
      const jsonValue = {
        foo: "string",
        bar: 123,
        list: [1, "foo", false],
      }

      const componentRegistry = getComponentRegistry()
      const element = createElementProp(jsonValue)
      render(
        <ComponentInstance
          element={element}
          registry={componentRegistry}
          width={100}
          disabled={false}
          theme={mockTheme.emotion}
          widgetMgr={
            new WidgetStateManager({
              sendRerunBackMsg: jest.fn(),
              formsDataChanged: jest.fn(),
            })
          }
        />
      )
      const iframe = screen.getByTitle(MOCK_COMPONENT_NAME)
      // SET COMPONENT_VALUE
      fireEvent(
        window,
        new MessageEvent("message", {
          data: {
            isStreamlitMessage: true,
            apiVersion: 1,
            type: ComponentMessageType.SET_COMPONENT_VALUE,
            dataType: "bytes",
            value: jsonValue,
          },
          // @ts-expect-error
          source: iframe.contentWindow,
        })
      )
      const widgetMgr = (WidgetStateManager as any).mock.instances[0]
      expect(widgetMgr.setJsonValue).not.toHaveBeenCalled()

      expect(logWarning).toHaveBeenCalledWith(
        `Got ${ComponentMessageType.SET_COMPONENT_VALUE} before ${ComponentMessageType.COMPONENT_READY}!`
      )
    })

    describe("SET_FRAME_HEIGHT handler", () => {
      it("updates the frameHeight without re-rendering", () => {
        const jsonValue = {}
        const componentRegistry = getComponentRegistry()
        const element = createElementProp(jsonValue)
        const { rerender } = render(
          <ComponentInstance
            element={element}
            registry={componentRegistry}
            width={100}
            disabled={false}
            theme={mockTheme.emotion}
            widgetMgr={
              new WidgetStateManager({
                sendRerunBackMsg: jest.fn(),
                formsDataChanged: jest.fn(),
              })
            }
          />
        )
        const iframe = screen.getByTitle(MOCK_COMPONENT_NAME)
        // SET COMPONENT_READY
        fireEvent(
          window,
          new MessageEvent("message", {
            data: {
              isStreamlitMessage: true,
              apiVersion: 1,
              type: ComponentMessageType.COMPONENT_READY,
            },
            // @ts-expect-error
            source: iframe.contentWindow,
          })
        )
        // SET IFRAME_HEIGHT
        fireEvent(
          window,
          new MessageEvent("message", {
            data: {
              isStreamlitMessage: true,
              apiVersion: 1,
              type: ComponentMessageType.SET_FRAME_HEIGHT,
              height: 100,
            },
            // @ts-expect-error
            source: iframe.contentWindow,
          })
        )

        rerender(
          <ComponentInstance
            element={element}
            registry={componentRegistry}
            width={100}
            disabled={false}
            theme={mockTheme.emotion}
            widgetMgr={
              new WidgetStateManager({
                sendRerunBackMsg: jest.fn(),
                formsDataChanged: jest.fn(),
              })
            }
          />
        )
        // Updating the frameheight intentionally does *not* cause a re-render
        // (instead, it directly updates the iframeRef) - so we can't check
        // that `child.prop("height") == 100`
        expect(iframe).toHaveAttribute("height", "100")
      })

      it("warns if called before COMPONENT_READY", () => {
        const jsonValue = {
          foo: "string",
          bar: 123,
          list: [1, "foo", false],
        }

        const componentRegistry = getComponentRegistry()
        const element = createElementProp(jsonValue)
        render(
          <ComponentInstance
            element={element}
            registry={componentRegistry}
            width={100}
            disabled={false}
            theme={mockTheme.emotion}
            widgetMgr={
              new WidgetStateManager({
                sendRerunBackMsg: jest.fn(),
                formsDataChanged: jest.fn(),
              })
            }
          />
        )
        const iframe = screen.getByTitle(MOCK_COMPONENT_NAME)
        // SET IFRAME_HEIGHT
        fireEvent(
          window,
          new MessageEvent("message", {
            data: {
              isStreamlitMessage: true,
              apiVersion: 1,
              type: ComponentMessageType.SET_FRAME_HEIGHT,
              height: 100,
            },
            // @ts-expect-error
            source: iframe.contentWindow,
          })
        )
        const widgetMgr = (WidgetStateManager as any).mock.instances[0]
        expect(widgetMgr.setJsonValue).not.toHaveBeenCalled()

        expect(logWarning).toHaveBeenCalledWith(
          `Got ${ComponentMessageType.SET_FRAME_HEIGHT} before ${ComponentMessageType.COMPONENT_READY}!`
        )
      })
    })
  })

  function renderMsg(
    args: { [name: string]: any },
    dataframes: any[],
    disabled = false,
    theme = {
      ...toExportedTheme(mockTheme.emotion),
      base: bgColorToBaseString(mockTheme.emotion.colors.bgColor),
      font: fonts.sansSerif,
    }
  ): any {
    return forwardMsg(StreamlitMessageType.RENDER, {
      args,
      dfs: dataframes,
      disabled,
      theme,
    })
  }

  function forwardMsg(type: StreamlitMessageType, data: any): any {
    return { type, ...data }
  }

  /** Create a ComponentInstance.props.element prop with the given args. */
  function createElementProp(
    jsonArgs: { [name: string]: any } = {},
    specialArgs: SpecialArg[] = []
  ): ComponentInstanceProto {
    return ComponentInstanceProto.create({
      jsonArgs: JSON.stringify(jsonArgs),
      specialArgs,
      componentName: MOCK_COMPONENT_NAME,
      id: MOCK_WIDGET_ID,
      url: MOCK_COMPONENT_URL,
    })
  }
})
