/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React from "react"
import {
  shallow,
  mount,
  ConnectionState,
  ScriptRunState,
  SessionEventDispatcher,
  mockTheme,
} from "@streamlit/lib"
import { SessionEvent } from "src/autogen/proto"

import StatusWidget, { StatusWidgetProps } from "./StatusWidget"

const getProps = (
  propOverrides: Partial<StatusWidgetProps> = {}
): StatusWidgetProps => ({
  connectionState: ConnectionState.CONNECTED,
  sessionEventDispatcher: new SessionEventDispatcher(),
  scriptRunState: ScriptRunState.RUNNING,
  rerunScript: () => {},
  stopScript: () => {},
  allowRunOnSave: true,
  theme: mockTheme.emotion,
  ...propOverrides,
})

describe("Tooltip element", () => {
  it("renders a Tooltip", () => {
    const wrapper = mount(<StatusWidget {...getProps()} />)

    expect(wrapper.find("StyledAppStatus").exists()).toBeTruthy()
  })

  it("renders its tooltip when disconnected", () => {
    const wrapper = mount(
      <StatusWidget
        {...getProps({ connectionState: ConnectionState.CONNECTING })}
      />
    )

    expect(wrapper.find("Tooltip").exists()).toBeTruthy()
  })

  it("renders its tooltip when connecting", () => {
    const wrapper = mount(
      <StatusWidget
        {...getProps({ connectionState: ConnectionState.CONNECTING })}
      />
    )

    expect(wrapper.find("Tooltip").exists()).toBeTruthy()
  })

  it("renders its tooltip when disconnected", () => {
    const wrapper = mount(
      <StatusWidget
        {...getProps({
          connectionState: ConnectionState.DISCONNECTED_FOREVER,
        })}
      />
    )

    expect(wrapper.find("Tooltip").exists()).toBeTruthy()
  })

  it("renders its tooltip when running and minimized", () => {
    const wrapper = mount(<StatusWidget {...getProps()} />)
    expect(wrapper.find("Tooltip").exists()).toBeFalsy()

    wrapper.find("StatusWidget").setState({ statusMinimized: true })
    expect(wrapper.find("Tooltip").exists()).toBeTruthy()
  })

  it("does not render its tooltip when connected", () => {
    const wrapper = shallow(
      <StatusWidget
        {...getProps({ connectionState: ConnectionState.CONNECTED })}
      />
    )

    expect(wrapper.find("Tooltip").exists()).toBeFalsy()
  })

  it("sets and unsets the sessionEventConnection", () => {
    const sessionEventDispatcher = new SessionEventDispatcher()
    const connectSpy = jest.fn()
    const disconnectSpy = jest.fn()
    sessionEventDispatcher.onSessionEvent.connect =
      connectSpy.mockImplementation(() => ({
        disconnect: disconnectSpy,
      }))

    const wrapper = mount(
      <StatusWidget {...getProps({ sessionEventDispatcher })} />
    )

    expect(connectSpy).toBeCalled()

    wrapper.unmount()

    expect(disconnectSpy).toBeCalled()
  })

  it("calls stopScript when clicked", () => {
    const stopScript = jest.fn()
    const wrapper = mount(<StatusWidget {...getProps({ stopScript })} />)

    wrapper.find("button").simulate("click")

    expect(stopScript).toBeCalled()
  })

  it("shows the rerun button when script changes", () => {
    const sessionEventDispatcher = new SessionEventDispatcher()
    const rerunScript = jest.fn()

    const wrapper = shallow(
      <StatusWidget
        {...getProps({
          rerunScript,
          sessionEventDispatcher,
          scriptRunState: ScriptRunState.NOT_RUNNING,
        })}
      />
    ).dive()

    sessionEventDispatcher.handleSessionEventMsg(
      new SessionEvent({
        scriptChangedOnDisk: true,
        scriptWasManuallyStopped: null,
        scriptCompilationException: null,
      })
    )

    expect(wrapper.find("Button").length).toEqual(2)

    wrapper.find("Button").at(0).simulate("click")
    expect(rerunScript).toBeCalledWith(false)
  })

  it("shows the always rerun button when script changes", () => {
    const sessionEventDispatcher = new SessionEventDispatcher()
    const rerunScript = jest.fn()

    const wrapper = shallow(
      <StatusWidget
        {...getProps({
          rerunScript,
          sessionEventDispatcher,
          scriptRunState: ScriptRunState.NOT_RUNNING,
        })}
      />
    ).dive()

    sessionEventDispatcher.handleSessionEventMsg(
      new SessionEvent({
        scriptChangedOnDisk: true,
        scriptWasManuallyStopped: null,
        scriptCompilationException: null,
      })
    )

    expect(wrapper.find("Button").length).toEqual(2)

    wrapper.find("Button").at(1).simulate("click")
    expect(rerunScript).toBeCalledWith(true)
  })

  it("does not show the always rerun button when script changes", () => {
    const sessionEventDispatcher = new SessionEventDispatcher()
    const rerunScript = jest.fn()

    const wrapper = shallow(
      <StatusWidget
        {...getProps({
          rerunScript,
          sessionEventDispatcher,
          scriptRunState: ScriptRunState.NOT_RUNNING,
          allowRunOnSave: false,
        })}
      />
    ).dive()

    sessionEventDispatcher.handleSessionEventMsg(
      new SessionEvent({
        scriptChangedOnDisk: true,
        scriptWasManuallyStopped: null,
        scriptCompilationException: null,
      })
    )

    expect(wrapper.find("Button").length).toEqual(1)
  })
})

describe("Running Icon", () => {
  it("renders regular running gif before New Years", () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("December 30, 2022 23:59:00"))

    const wrapper = mount(
      <StatusWidget
        {...getProps({ scriptRunState: ScriptRunState.RUNNING })}
      />
    )
    expect(wrapper.find("StyledAppRunningIcon").props().src).toBe(
      "icon_running.gif"
    )
  })

  it("renders firework gif on Dec 31st", () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("December 31, 2022 00:00:00"))

    const wrapper = mount(
      <StatusWidget
        {...getProps({ scriptRunState: ScriptRunState.RUNNING })}
      />
    )

    expect(wrapper.find("StyledAppRunningIcon").props().src).toBe(
      "fireworks.gif"
    )
  })

  it("renders firework gif on Jan 6th", () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("January 6, 2023 23:59:00"))

    const wrapper = mount(
      <StatusWidget
        {...getProps({ scriptRunState: ScriptRunState.RUNNING })}
      />
    )
    expect(wrapper.find("StyledAppRunningIcon").props().src).toBe(
      "fireworks.gif"
    )
  })

  it("renders regular running gif after New Years", () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("January 7, 2023 00:00:00"))

    const wrapper = mount(
      <StatusWidget
        {...getProps({ scriptRunState: ScriptRunState.RUNNING })}
      />
    )
    expect(wrapper.find("StyledAppRunningIcon").props().src).toBe(
      "icon_running.gif"
    )
  })
})
