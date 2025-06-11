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

import React from "react"

import { fireEvent, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { render, ScriptRunState } from "@streamlit/lib"
import { SessionEvent } from "@streamlit/protobuf"
import { ConnectionState } from "@streamlit/connection"
import { SessionEventDispatcher } from "@streamlit/app/src/SessionEventDispatcher"

import StatusWidget, { StatusWidgetProps } from "./StatusWidget"

const getProps = (
  propOverrides: Partial<StatusWidgetProps> = {}
): StatusWidgetProps => ({
  connectionState: ConnectionState.CONNECTED,
  sessionEventDispatcher: new SessionEventDispatcher(),
  scriptRunState: ScriptRunState.RUNNING,
  rerunScript: vi.fn(),
  stopScript: () => {},
  allowRunOnSave: true,
  ...propOverrides,
})

describe("StatusWidget element", () => {
  it("renders a StatusWidget", () => {
    render(<StatusWidget {...getProps()} />)

    expect(screen.getByTestId("stStatusWidget")).toBeInTheDocument()
  })

  it("renders its tooltip when connecting", () => {
    render(
      <StatusWidget
        {...getProps({ connectionState: ConnectionState.CONNECTING })}
      />
    )

    expect(screen.getByTestId("stStatusWidget")).toBeInTheDocument()
    expect(screen.getByText("Connecting")).toBeInTheDocument()
    expect(screen.getByTestId("stTooltipHoverTarget")).toBeInTheDocument()
  })

  it("renders its tooltip when disconnected", () => {
    render(
      <StatusWidget
        {...getProps({
          connectionState: ConnectionState.DISCONNECTED_FOREVER,
        })}
      />
    )

    expect(screen.getByTestId("stStatusWidget")).toBeInTheDocument()
    expect(screen.getByText("Error")).toBeInTheDocument()
    expect(screen.getByTestId("stTooltipHoverTarget")).toBeInTheDocument()
  })

  it("renders its tooltip when running and minimized", async () => {
    vi.useFakeTimers()
    render(<StatusWidget {...getProps()} />)
    expect(
      screen.queryByTestId("stTooltipHoverTarget")
    ).not.toBeInTheDocument()

    // Set scrollY so shouldMinimize returns true
    global.scrollY = 50

    render(<StatusWidget {...getProps()} />)
    vi.runAllTimers()
    expect(await screen.findByTestId("stTooltipHoverTarget")).toBeVisible()

    // Reset scrollY for following tests not impacted
    global.scrollY = 0
  })

  it("does not render its tooltip when connected", () => {
    render(
      <StatusWidget
        {...getProps({ connectionState: ConnectionState.CONNECTED })}
      />
    )

    expect(
      screen.queryByTestId("stTooltipHoverTarget")
    ).not.toBeInTheDocument()
  })

  it("sets and unsets the sessionEventConnection", () => {
    const sessionEventDispatcher = new SessionEventDispatcher()
    const connectSpy = vi.fn()
    const disconnectSpy = vi.fn()
    sessionEventDispatcher.onSessionEvent.connect =
      connectSpy.mockImplementation(() => ({
        disconnect: disconnectSpy,
      }))

    const { unmount } = render(
      <StatusWidget {...getProps({ sessionEventDispatcher })} />
    )

    expect(connectSpy).toHaveBeenCalled()

    unmount()

    expect(disconnectSpy).toHaveBeenCalled()
  })

  it("calls stopScript when clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.useFakeTimers()
    const stopScript = vi.fn()
    render(<StatusWidget {...getProps({ stopScript })} />)

    // Advance timers to ensure the running animation is shown
    vi.runAllTimers()

    // Wait for the stop button to appear
    const stopButton = await screen.findByRole("button", { name: "Stop" })

    await user.click(stopButton)

    expect(stopScript).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it("shows the rerun button when script changes", async () => {
    const user = userEvent.setup()
    const sessionEventDispatcher = new SessionEventDispatcher()
    const rerunScript = vi.fn()

    render(
      <StatusWidget
        {...getProps({
          rerunScript,
          sessionEventDispatcher,
          scriptRunState: ScriptRunState.NOT_RUNNING,
        })}
      />
    )

    sessionEventDispatcher.handleSessionEventMsg(
      new SessionEvent({
        scriptChangedOnDisk: true,
        scriptWasManuallyStopped: null,
        scriptCompilationException: null,
      })
    )

    const buttons = await waitFor(() => {
      const foundButtons = screen.getAllByRole("button")
      expect(foundButtons).toHaveLength(2)
      return foundButtons
    })

    expect(buttons[0]).toHaveTextContent("Rerun")
    expect(buttons[1]).toHaveTextContent("Always rerun")

    // Click "Rerun" button
    await user.click(buttons[0])

    expect(rerunScript).toHaveBeenCalledWith(false)
  })

  it("shows the always rerun button when script changes", async () => {
    const user = userEvent.setup()
    const sessionEventDispatcher = new SessionEventDispatcher()
    const rerunScript = vi.fn()

    render(
      <StatusWidget
        {...getProps({
          rerunScript,
          sessionEventDispatcher,
          scriptRunState: ScriptRunState.NOT_RUNNING,
        })}
      />
    )

    sessionEventDispatcher.handleSessionEventMsg(
      new SessionEvent({
        scriptChangedOnDisk: true,
        scriptWasManuallyStopped: null,
        scriptCompilationException: null,
      })
    )

    const buttons = await waitFor(() => {
      const foundButtons = screen.getAllByRole("button")
      expect(foundButtons).toHaveLength(2)
      return foundButtons
    })

    expect(buttons[0]).toHaveTextContent("Rerun")
    expect(buttons[1]).toHaveTextContent("Always rerun")

    // Click "Always Rerun" button
    await user.click(buttons[1])

    expect(rerunScript).toHaveBeenCalledWith(true)
  })

  it("does not show the always rerun button when script changes", async () => {
    const sessionEventDispatcher = new SessionEventDispatcher()
    const rerunScript = vi.fn()

    render(
      <StatusWidget
        {...getProps({
          rerunScript,
          sessionEventDispatcher,
          scriptRunState: ScriptRunState.NOT_RUNNING,
          allowRunOnSave: false,
        })}
      />
    )

    sessionEventDispatcher.handleSessionEventMsg(
      new SessionEvent({
        scriptChangedOnDisk: true,
        scriptWasManuallyStopped: null,
        scriptCompilationException: null,
      })
    )

    const buttons = await waitFor(() => {
      const foundButtons = screen.getAllByRole("button")
      expect(foundButtons).toHaveLength(1)
      return foundButtons
    })

    expect(buttons[0]).toHaveTextContent("Rerun")
  })

  it("calls always run on save", async () => {
    const sessionEventDispatcher = new SessionEventDispatcher()
    const rerunScript = vi.fn()

    render(
      <StatusWidget
        {...getProps({
          rerunScript,
          sessionEventDispatcher,
          scriptRunState: ScriptRunState.NOT_RUNNING,
        })}
      />
    )

    sessionEventDispatcher.handleSessionEventMsg(
      new SessionEvent({
        scriptChangedOnDisk: true,
        scriptWasManuallyStopped: null,
        scriptCompilationException: null,
      })
    )
    // Verify the Always rerun is visible
    expect(await screen.findByText("Always rerun")).toBeVisible()

    // Use fireEvent for document-level keyboard events since react-hot-keys listens at document level
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.keyDown(document.body, {
      key: "a",
      which: 65,
    })

    expect(rerunScript).toHaveBeenCalledWith(true)
  })
})

describe("Running Icon", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders regular running gif before New Years", async () => {
    vi.setSystemTime(new Date("December 30, 2022 23:59:00"))

    render(
      <StatusWidget
        {...getProps({ scriptRunState: ScriptRunState.RUNNING })}
      />
    )

    vi.runAllTimers()

    await waitFor(() => {
      const icon = screen.queryByRole("img")
      expect(icon).toHaveAttribute("src", "/src/assets/img/icon_running.gif")
    })
  })

  it("renders firework gif on Dec 31st", async () => {
    vi.setSystemTime(new Date("December 31, 2022 00:00:00"))

    render(
      <StatusWidget
        {...getProps({ scriptRunState: ScriptRunState.RUNNING })}
      />
    )

    vi.runAllTimers()

    await waitFor(() => {
      const icon = screen.queryByRole("img")
      expect(icon).toHaveAttribute("src", "/src/assets/img/fireworks.gif")
    })
  })

  it("renders firework gif on Jan 6th", async () => {
    vi.setSystemTime(new Date("January 6, 2023 23:59:00"))

    render(
      <StatusWidget
        {...getProps({ scriptRunState: ScriptRunState.RUNNING })}
      />
    )

    vi.runAllTimers()

    await waitFor(() => {
      const icon = screen.queryByRole("img")
      expect(icon).toHaveAttribute("src", "/src/assets/img/fireworks.gif")
    })
  })

  it("renders regular running gif after New Years", async () => {
    vi.setSystemTime(new Date("January 7, 2023 00:00:00"))

    render(
      <StatusWidget
        {...getProps({ scriptRunState: ScriptRunState.RUNNING })}
      />
    )

    vi.runAllTimers()

    await waitFor(() => {
      const icon = screen.queryByRole("img")
      expect(icon).toHaveAttribute("src", "/src/assets/img/icon_running.gif")
    })
  })

  it("delays render of running gif", async () => {
    // Set system time so test doesn't fail during New Years
    vi.setSystemTime(new Date("January 7, 2023 00:00:00"))

    render(
      <StatusWidget
        {...getProps({ scriptRunState: ScriptRunState.RUNNING })}
      />
    )

    const icon = screen.queryByRole("img")
    expect(icon).not.toBeInTheDocument()

    vi.runAllTimers()

    await waitFor(() => {
      const foundIcon = screen.getByRole("img")
      expect(foundIcon).toHaveAttribute(
        "src",
        "/src/assets/img/icon_running.gif"
      )
    })
  })
})
