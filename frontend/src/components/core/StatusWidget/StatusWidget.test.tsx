/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

import React from "react"
import { shallow, mount } from "src/lib/test_util"
import { ConnectionState } from "src/lib/ConnectionState"
import { ReportRunState } from "src/lib/ReportRunState"
import { SessionEventDispatcher } from "src/lib/SessionEventDispatcher"
import { SessionEvent } from "src/autogen/proto"
import { darkTheme, lightTheme } from "src/theme"

import StatusWidget, { StatusWidgetProps } from "./StatusWidget"

const getProps = (
  propOverrides: Partial<StatusWidgetProps> = {}
): StatusWidgetProps => ({
  connectionState: ConnectionState.CONNECTED,
  sessionEventDispatcher: new SessionEventDispatcher(),
  reportRunState: ReportRunState.RUNNING,
  rerunReport: () => {},
  stopReport: () => {},
  allowRunOnSave: true,
  theme: lightTheme.emotion,
  ...propOverrides,
})

const customLightTheme = {
  ...lightTheme.emotion,
  colors: {
    ...lightTheme.emotion.colors,
    bgColor: "#dddddd",
  },
}

const customDarkTheme = {
  ...darkTheme.emotion,
  colors: {
    ...darkTheme.emotion.colors,
    bgColor: "#203d3f",
  },
}

describe("Tooltip element", () => {
  it("renders a Tooltip", () => {
    const wrapper = mount(<StatusWidget {...getProps()} />)

    expect(wrapper.find("StyledReportStatus").exists()).toBeTruthy()
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

  it("does not render its tooltip when static", () => {
    const wrapper = shallow(
      <StatusWidget
        {...getProps({ connectionState: ConnectionState.STATIC })}
      />
    )

    expect(wrapper.find("Tooltip").exists()).toBeFalsy()
  })

  it("renders running img correctly with lightTheme", () => {
    const wrapper = mount(<StatusWidget {...getProps()} />)
    expect(wrapper).toMatchSnapshot()
  })

  it("renders running img correctly with custom light background color", () => {
    const wrapper = mount(
      <StatusWidget {...getProps({ theme: customLightTheme })} />
    )
    expect(wrapper).toMatchSnapshot()
  })

  it("renders running img correctly with darkTheme", () => {
    const wrapper = mount(
      <StatusWidget {...getProps({ theme: darkTheme.emotion })} />
    )
    expect(wrapper).toMatchSnapshot()
  })

  it("renders running img correctly with custom dark background color", () => {
    const wrapper = mount(
      <StatusWidget {...getProps({ theme: customDarkTheme })} />
    )
    expect(wrapper).toMatchSnapshot()
  })

  it("sets and unsets the sessionEventConnection", () => {
    const sessionEventDispatcher = new SessionEventDispatcher()
    const connectSpy = jest.fn()
    const disconnectSpy = jest.fn()
    sessionEventDispatcher.onSessionEvent.connect = connectSpy.mockImplementation(
      () => ({
        disconnect: disconnectSpy,
      })
    )

    const wrapper = mount(
      <StatusWidget {...getProps({ sessionEventDispatcher })} />
    )

    expect(connectSpy).toBeCalled()

    wrapper.unmount()

    expect(disconnectSpy).toBeCalled()
  })

  it("calls stopReport when clicked", () => {
    const stopReport = jest.fn()
    const wrapper = mount(<StatusWidget {...getProps({ stopReport })} />)

    wrapper.find("Button").simulate("click")

    expect(stopReport).toBeCalled()
  })

  it("shows the rerun button when report changes", () => {
    const sessionEventDispatcher = new SessionEventDispatcher()
    const rerunReport = jest.fn()

    const wrapper = shallow(
      <StatusWidget
        {...getProps({
          rerunReport,
          sessionEventDispatcher,
          reportRunState: ReportRunState.NOT_RUNNING,
        })}
      />
    )
      .dive()
      .dive() // Diving through withTheme

    sessionEventDispatcher.handleSessionEventMsg(
      new SessionEvent({
        reportChangedOnDisk: true,
        reportWasManuallyStopped: null,
        scriptCompilationException: null,
      })
    )

    expect(wrapper.find("Button").length).toEqual(2)

    wrapper
      .find("Button")
      .at(0)
      .simulate("click")
    expect(rerunReport).toBeCalledWith(false)
  })

  it("shows the always rerun button when report changes", () => {
    const sessionEventDispatcher = new SessionEventDispatcher()
    const rerunReport = jest.fn()

    const wrapper = shallow(
      <StatusWidget
        {...getProps({
          rerunReport,
          sessionEventDispatcher,
          reportRunState: ReportRunState.NOT_RUNNING,
        })}
      />
    )
      .dive()
      .dive() // Diving through withTheme

    sessionEventDispatcher.handleSessionEventMsg(
      new SessionEvent({
        reportChangedOnDisk: true,
        reportWasManuallyStopped: null,
        scriptCompilationException: null,
      })
    )

    expect(wrapper.find("Button").length).toEqual(2)

    wrapper
      .find("Button")
      .at(1)
      .simulate("click")
    expect(rerunReport).toBeCalledWith(true)
  })

  it("does not show the always rerun button when report changes", () => {
    const sessionEventDispatcher = new SessionEventDispatcher()
    const rerunReport = jest.fn()

    const wrapper = shallow(
      <StatusWidget
        {...getProps({
          rerunReport,
          sessionEventDispatcher,
          reportRunState: ReportRunState.NOT_RUNNING,
          allowRunOnSave: false,
        })}
      />
    )
      .dive()
      .dive() // Diving through withTheme

    sessionEventDispatcher.handleSessionEventMsg(
      new SessionEvent({
        reportChangedOnDisk: true,
        reportWasManuallyStopped: null,
        scriptCompilationException: null,
      })
    )

    expect(wrapper.find("Button").length).toEqual(1)
  })
})
