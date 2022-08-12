import React from "react"
import { shallow, mount } from "src/lib/test_util"
import { ConnectionState } from "src/lib/ConnectionState"
import { ScriptRunState } from "src/lib/ScriptRunState"
import { SessionEventDispatcher } from "src/lib/SessionEventDispatcher"
import { SessionEvent } from "src/autogen/proto"
import { lightTheme } from "src/theme"

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
  theme: lightTheme.emotion,
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

    wrapper
      .find("Button")
      .at(0)
      .simulate("click")
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

    wrapper
      .find("Button")
      .at(1)
      .simulate("click")
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
