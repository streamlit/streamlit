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

import { RefObject } from "react"
import "@testing-library/jest-dom"

import { mockTheme } from "@streamlit/lib/src/mocks/mockTheme"

import {
  CUSTOM_COMPONENT_API_VERSION,
  IframeMessage,
  IframeMessageHandlerProps,
  createIframeMessageHandler,
  parseArgs,
  sendRenderMessage,
} from "./componentUtils"
import { ComponentMessageType, StreamlitMessageType } from "./enums"
import {
  ArrowDataframe,
  ComponentInstance as ComponentInstanceProto,
} from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"

// Mock our WidgetStateManager
jest.mock("@streamlit/lib/src/WidgetStateManager")

describe("test componentUtils", () => {
  describe("createIframeMsgHandler", () => {
    const element = ComponentInstanceProto.create({})
    let widgetMgr: WidgetStateManager
    let setComponentError: jest.Mock
    let componentReadyCallback: jest.Mock
    let frameHeightCallback: jest.Mock

    let ref: RefObject<IframeMessageHandlerProps>
    let iframeMessageHandler: (type: string, data: IframeMessage) => void

    beforeEach(() => {
      // Clear our class mocks
      const mockWidgetStateManager = WidgetStateManager as unknown as jest.Mock
      mockWidgetStateManager.mockClear()

      componentReadyCallback = jest.fn()
      frameHeightCallback = jest.fn()
      setComponentError = jest.fn()
      widgetMgr = new WidgetStateManager({
        sendRerunBackMsg: jest.fn(),
        formsDataChanged: jest.fn(),
      })
      ref = {
        current: {
          isReady: true,
          element,
          widgetMgr,
          setComponentError,
          componentReadyCallback,
          frameHeightCallback,
        },
      }
      iframeMessageHandler = createIframeMessageHandler(ref)
    })

    it("should call readyCallback when iframeMessageHandler receives COMPONENT_READY message", () => {
      iframeMessageHandler(ComponentMessageType.COMPONENT_READY, {
        apiVersion: CUSTOM_COMPONENT_API_VERSION,
      })
      expect(componentReadyCallback).toBeCalledTimes(1)
    })

    it("should call componentErrorCallback when iframeMessageHandler receives message with wrong API version", () => {
      iframeMessageHandler(ComponentMessageType.COMPONENT_READY, {
        apiVersion: CUSTOM_COMPONENT_API_VERSION + 1,
      })
      expect(componentReadyCallback).toBeCalledTimes(0)
      expect(setComponentError).toBeCalledTimes(1)
    })

    it("should call frameHeightCallback when iframeMessageHandler receives SET_FRAME_HEIGHT message", () => {
      const height = 100
      iframeMessageHandler(ComponentMessageType.SET_FRAME_HEIGHT, {
        height: height,
      })

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      ref.current!.isReady = false
      // when isReady = false, the callback should not be called
      iframeMessageHandler(ComponentMessageType.SET_FRAME_HEIGHT, {
        height: height,
      })

      expect(frameHeightCallback).toBeCalledTimes(1)
      expect(frameHeightCallback).toBeCalledWith(height)
    })

    it("should call widgetManager when iframeMessageHandler receives SET_COMPONENT_VALUE message", () => {
      const jsonValue = { someData: "foo" }
      iframeMessageHandler(ComponentMessageType.SET_COMPONENT_VALUE, {
        value: jsonValue,
        dataType: "json",
      })

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      ref.current!.isReady = false
      // when isReady = false, the callback should not be called
      iframeMessageHandler(ComponentMessageType.SET_COMPONENT_VALUE, {
        value: jsonValue,
        dataType: "json",
      })

      expect(widgetMgr.setJsonValue).toBeCalledTimes(1)
      expect(widgetMgr.setJsonValue).toHaveBeenCalledWith(element, jsonValue, {
        fromUi: true,
      })
    })
  })

  describe("sendRenderMessage", () => {
    it("should send message to iframe", () => {
      const handleAction = jest.fn()

      const mockIframe: any = {
        contentWindow: {
          postMessage: handleAction,
        },
      }

      const args = { foo: "bar" }
      const dataframeArgs = [{ key: "foo", value: "bar" }]
      const disabled = true

      sendRenderMessage(
        args,
        dataframeArgs,
        disabled,
        mockTheme.emotion,
        mockIframe
      )
      expect(handleAction).toBeCalledTimes(1)
      expect(handleAction).toHaveBeenCalledWith(
        {
          type: StreamlitMessageType.RENDER,
          args,
          dfs: dataframeArgs,
          disabled,
          theme: expect.any(Object),
        },
        "*"
      )
    })

    it("should not send message when iframe is undefined", () => {
      const handleAction = jest.fn()

      const mockIframe: any = undefined
      sendRenderMessage({}, [], false, mockTheme.emotion, mockIframe)
      expect(handleAction).toBeCalledTimes(0)
    })

    it("should not send message when iframe's content window is undefined", () => {
      const handleAction = jest.fn()

      const mockIframe: any = {
        contentWindow: undefined,
      }
      sendRenderMessage({}, [], false, mockTheme.emotion, mockIframe)
      expect(handleAction).toBeCalledTimes(0)
    })
  })

  describe("parseArgs", () => {
    it("should parse jsonArgs and specialArgs", () => {
      const args = { foo: "bar", "some-bytes": new Uint8Array(8) }
      const someBytes = new Uint8Array(8)
      // set one byte to a different value
      someBytes[1] = 10
      const arrowDataframe = new ArrowDataframe()
      arrowDataframe.height = 100
      const specialArgs = [
        {
          key: "some-dataframe",
          value: "arrowDataFrame",
          arrowDataframe: arrowDataframe,
        },
        {
          key: "some-bytes",
          value: "bytes",
          bytes: someBytes,
        },
      ]

      const [newArgs, dataframeArgs] = parseArgs(
        JSON.stringify(args),
        specialArgs
      )
      expect(newArgs).toMatchObject({ foo: "bar", "some-bytes": someBytes })
      expect(dataframeArgs).toMatchObject([
        {
          key: "some-dataframe",
          value: arrowDataframe,
        },
      ])
    })

    it("should throw an error with with unknown specialArgs type", () => {
      const args = {}
      const specialArgs = [
        {
          key: "some-dataframe",
          value: "some-unknown-type",
        },
      ]

      expect(() => parseArgs(JSON.stringify(args), specialArgs)).toThrowError(
        Error
      )
    })
  })
})
