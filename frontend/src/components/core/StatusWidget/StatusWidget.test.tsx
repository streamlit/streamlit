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
import { shallow } from "lib/test_util"
import { ConnectionState } from "lib/ConnectionState"
import { ReportRunState } from "lib/ReportRunState"
import { SessionEventDispatcher } from "lib/SessionEventDispatcher"
import { SessionEvent } from "autogen/proto"

import StatusWidget, { StatusWidgetProps } from "./StatusWidget"

const getProps = (
  propOverrides: Partial<StatusWidgetProps> = {}
): StatusWidgetProps => ({
  connectionState: ConnectionState.CONNECTED,
  sessionEventDispatcher: new SessionEventDispatcher(),
  reportRunState: ReportRunState.RUNNING,
  rerunReport: (alwaysRerun: boolean) => {},
  stopReport: () => {},
  allowRunOnSave: true,
  ...propOverrides,
})

describe("Tooltip element", () => {
  it("renders a Tooltip", () => {
    const wrapper = shallow(<StatusWidget {...getProps()} />)

    expect(wrapper.find("StyledReportStatus").exists()).toBeTruthy()
  })

  it("renders its tooltip when disconnected", () => {
    const wrapper = shallow(
      <StatusWidget
        {...getProps({ connectionState: ConnectionState.CONNECTING })}
      />
    )

    expect(wrapper.find("Tooltip").exists()).toBeTruthy()
  })

  it("renders its tooltip when connecting", () => {
    const wrapper = shallow(
      <StatusWidget
        {...getProps({ connectionState: ConnectionState.CONNECTING })}
      />
    )

    expect(wrapper.find("Tooltip").exists()).toBeTruthy()
  })

  it("renders its tooltip when disconnected", () => {
    const wrapper = shallow(
      <StatusWidget
        {...getProps({
          connectionState: ConnectionState.DISCONNECTED_FOREVER,
        })}
      />
    )

    expect(wrapper.find("Tooltip").exists()).toBeTruthy()
  })

  it("renders its tooltip when running and minimized", () => {
    const wrapper = shallow(<StatusWidget {...getProps()} />)
    expect(wrapper.find("Tooltip").exists()).toBeFalsy()

    wrapper.setState({ statusMinimized: true })
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

  it("sets and unsets the sessionEventConnection", () => {
    const sessionEventDispatcher = new SessionEventDispatcher()
    const connectSpy = jest.fn()
    const disconnectSpy = jest.fn()
    sessionEventDispatcher.onSessionEvent.connect = connectSpy.mockImplementation(
      () => ({
        disconnect: disconnectSpy,
      })
    )

    const wrapper = shallow<StatusWidget>(
      <StatusWidget {...getProps({ sessionEventDispatcher })} />
    )

    expect(connectSpy).toBeCalled()

    wrapper.unmount()

    expect(disconnectSpy).toBeCalled()
  })

  it("calls stopReport when clicked", () => {
    const stopReport = jest.fn()
    const wrapper = shallow<StatusWidget>(
      <StatusWidget {...getProps({ stopReport })} />
    )

    wrapper.find("Button").simulate("click")

    expect(stopReport).toBeCalled()
  })

  it("shows the rerun button when report changes", () => {
    const sessionEventDispatcher = new SessionEventDispatcher()
    const rerunReport = jest.fn()

    const wrapper = shallow<StatusWidget>(
      <StatusWidget
        {...getProps({
          rerunReport,
          sessionEventDispatcher,
          reportRunState: ReportRunState.NOT_RUNNING,
        })}
      />
    )

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

    const wrapper = shallow<StatusWidget>(
      <StatusWidget
        {...getProps({
          rerunReport,
          sessionEventDispatcher,
          reportRunState: ReportRunState.NOT_RUNNING,
        })}
      />
    )

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

    const wrapper = shallow<StatusWidget>(
      <StatusWidget
        {...getProps({
          rerunReport,
          sessionEventDispatcher,
          reportRunState: ReportRunState.NOT_RUNNING,
          allowRunOnSave: false,
        })}
      />
    )

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
