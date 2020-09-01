/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import ErrorElement from "components/shared/ErrorElement"
import { mount, ReactWrapper } from "enzyme"
import { fromJS } from "immutable"
import { logWarning } from "lib/log"
import { buildHttpUri } from "lib/UriUtil"
import { Source, WidgetStateManager } from "lib/WidgetStateManager"
import React from "react"
import { ComponentInstance, Props, State } from "./ComponentInstance"
import { ComponentRegistry } from "./ComponentRegistry"
import { ComponentMessageType, StreamlitMessageType } from "./enums"

// Mock log functions.
jest.mock("lib/log")

// Mock uri utils.
jest.mock("lib/UriUtil")
const mockedBuildHttpUri = buildHttpUri as jest.Mock
mockedBuildHttpUri.mockImplementation(() => "registry/url")

const getProps = (elementProps = {}): Props => ({
  element: fromJS({
    argsDataframe: [],
    argsJson: '{"foo": "bar"}',
    componentName: "some.component",
    id: "some_id",
    url: "some/url",
    ...elementProps,
  }),
  registry: new ComponentRegistry(() =>
    fromJS({
      host: "streamlit.mock",
      port: 80,
      basePath: "",
    })
  ),
  width: 100,
  disabled: false,
  widgetMgr: new WidgetStateManager(jest.fn()),
})

describe("ComponentInstance", () => {
  let wrapper: ReactWrapper<Props, State, ComponentInstance>
  let instance: ComponentInstance

  beforeEach(() => {
    const props = getProps()
    const mountNode = document.createElement("div")
    document.body.appendChild(mountNode)

    // We need to mount the ComponentInstance to an existing DOM element.
    // Otherwise, iframe contentWindow is not available.
    wrapper = mount(<ComponentInstance {...props} />, { attachTo: mountNode })
    instance = wrapper.instance()
  })

  describe("handleSetComponentValue", () => {
    let handleSetComponentValue: (data: any, source: Source) => void
    const source = { fromUi: true }

    beforeEach(() => {
      handleSetComponentValue = instance["handleSetComponentValue"]
      WidgetStateManager.prototype.setJsonValue = jest.fn()
    })

    it("should warn that the `value` prop is missing", () => {
      handleSetComponentValue({ value: undefined }, source)
      expect(logWarning).toHaveBeenCalledWith(
        `handleSetComponentValue: missing 'value' prop`
      )
      expect(WidgetStateManager.prototype.setJsonValue).not.toHaveBeenCalled()
    })

    it("should set widget value", () => {
      handleSetComponentValue({ value: 1 }, source)
      expect(WidgetStateManager.prototype.setJsonValue).toHaveBeenCalledWith(
        "some_id",
        1,
        source
      )
    })
  })

  describe("handleSetFrameHeight", () => {
    let handleSetFrameHeight: (data: any) => void

    beforeEach(() => {
      handleSetFrameHeight = instance["handleSetFrameHeight"]
    })

    it("should warn that the `height` prop is missing", () => {
      handleSetFrameHeight({ height: undefined })
      expect(logWarning).toHaveBeenCalledWith(
        `handleSetFrameHeight: missing 'height' prop`
      )
      expect(instance["frameHeight"]).toEqual(0)
    })

    it("should set iframe height", () => {
      handleSetFrameHeight({ height: 100 })
      expect(instance["frameHeight"]).toEqual(100)
    })

    it("should warn that the `iframeRef` prop is missing", () => {
      // @ts-ignore
      instance["iframeRef"]["current"] = null
      handleSetFrameHeight({ height: 200 })
      expect(logWarning).toHaveBeenCalledWith(
        `handleSetFrameHeight: missing our iframeRef!`
      )
    })
  })

  describe("sendForwardMsg", () => {
    let sendForwardMsg: (type: StreamlitMessageType, data: any) => void
    const renderType = StreamlitMessageType.RENDER
    const data = {
      args: { foo: "bar" },
      dfs: [],
    }

    beforeEach(() => {
      sendForwardMsg = instance["sendForwardMsg"]
    })

    it("should call postMessage", () => {
      // @ts-ignore
      instance["iframeRef"]["current"]["contentWindow"].postMessage = jest.fn()
      sendForwardMsg(renderType, data)
      expect(
        // @ts-ignore
        instance["iframeRef"]["current"]["contentWindow"].postMessage
      ).toHaveBeenCalledWith({ type: renderType, ...data }, "*")
    })

    it("should warn that the iframe is missing", () => {
      // @ts-ignore
      instance["iframeRef"]["current"] = null
      sendForwardMsg(renderType, data)
      expect(logWarning).toHaveBeenCalledWith(
        "Can't send ForwardMsg; missing our iframe!"
      )
    })
  })

  describe("onBackMsg", () => {
    let onBackMsg: (type: string, data: any) => void

    beforeEach(() => {
      onBackMsg = instance["onBackMsg"]
    })

    describe("COMPONENT_READY", () => {
      const componentReadyType = ComponentMessageType.COMPONENT_READY

      it("should throw `Unrecognized component API version` exception", () => {
        onBackMsg(componentReadyType, { apiVersion: "bad_api_version" })
        // @ts-ignore
        expect(instance["state"]["componentError"]["message"]).toBe(
          "Unrecognized component API version: 'bad_api_version'"
        )
      })

      it("should set component ready to true", () => {
        onBackMsg(componentReadyType, { apiVersion: 1 })
        expect(instance["componentReady"]).toBe(true)
      })

      it("should call postMessage", () => {
        instance["sendForwardMsg"] = jest.fn()
        onBackMsg(componentReadyType, { apiVersion: 1 })
        expect(instance["sendForwardMsg"]).toHaveBeenCalledWith(
          StreamlitMessageType.RENDER,
          {
            args: { foo: "bar" },
            dfs: [],
          }
        )
      })
    })

    describe("SET_COMPONENT_VALUE", () => {
      const type = ComponentMessageType.SET_COMPONENT_VALUE
      const data = { value: 1 }

      it("should call handleSetComponentValue", () => {
        instance["handleSetComponentValue"] = jest.fn()
        instance["componentReady"] = true
        onBackMsg(type, data)
        expect(instance["handleSetComponentValue"]).toHaveBeenCalledWith(
          data,
          {
            fromUi: true,
          }
        )
      })

      it("should warn component is not ready", () => {
        instance["componentReady"] = false
        onBackMsg(type, data)
        expect(logWarning).toHaveBeenCalledWith(
          "Got streamlit:setComponentValue before streamlit:componentReady!"
        )
      })
    })

    describe("SET_FRAME_HEIGHT", () => {
      const setFrameHeightType = ComponentMessageType.SET_FRAME_HEIGHT
      const data = { height: 100 }

      it("should call handleSetFrameHeight", () => {
        instance["handleSetFrameHeight"] = jest.fn()
        instance["componentReady"] = true
        onBackMsg(setFrameHeightType, data)
        expect(instance["handleSetFrameHeight"]).toHaveBeenCalledWith(data)
      })

      it("should warn that the component is not ready", () => {
        instance["componentReady"] = false
        onBackMsg(setFrameHeightType, data)
        expect(logWarning).toHaveBeenCalledWith(
          "Got streamlit:setFrameHeight before streamlit:componentReady!"
        )
      })
    })

    it("should warn with `Unrecognized ComponentBackMsgType`", () => {
      const type = "Wrong type"
      onBackMsg(type, {})
      expect(logWarning).toHaveBeenCalledWith(
        "Unrecognized ComponentBackMsgType: Wrong type"
      )
    })
  })

  describe("Render iframe", () => {
    const element = document.createElement("div")
    document.body.appendChild(element)

    it("should render ErrorElement", () => {
      const componentError = {
        name: "foo",
        message: "bar",
      }
      wrapper.setState({ componentError })
      expect(
        wrapper.containsMatchingElement(<ErrorElement {...componentError} />)
      ).toBeTruthy()
    })

    it("should render iframe and set `src` to registry/url", () => {
      const props = getProps({ url: "" })
      const wrapper = mount<ComponentInstance>(
        <ComponentInstance {...props} />,
        {
          attachTo: element,
        }
      )
      expect(wrapper.find("iframe").props()).toMatchSnapshot()
    })

    it("should render iframe and set `src` to element url", () => {
      expect(wrapper.find("iframe").props()).toMatchSnapshot()
    })
  })
})
