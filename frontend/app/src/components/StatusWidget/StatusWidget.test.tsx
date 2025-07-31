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

import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ConnectionState } from "@streamlit/connection"
import { render, ScriptRunState } from "@streamlit/lib"

import StatusWidget, { StatusWidgetProps } from "./StatusWidget"

const getProps = (
  propOverrides: Partial<StatusWidgetProps> = {}
): StatusWidgetProps => ({
  connectionState: ConnectionState.CONNECTED,
  scriptRunState: ScriptRunState.NOT_RUNNING,
  rerunScript: vi.fn(),
  stopScript: vi.fn(),
  allowRunOnSave: true,
  showScriptChangedActions: false,
  ...propOverrides,
})

describe("StatusWidget element", () => {
  it("renders a StatusWidget", () => {
    // StatusWidget only renders when there's something to show
    // For CONNECTED state with NOT_RUNNING script, it doesn't render
    // So we test with a showScriptChangedActions=true to make it render
    render(<StatusWidget {...getProps({ showScriptChangedActions: true })} />)

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

  it("does not render its tooltip when connected", () => {
    // When connected with script changes, it should render without tooltip
    render(
      <StatusWidget
        {...getProps({
          connectionState: ConnectionState.CONNECTED,
          showScriptChangedActions: true,
        })}
      />
    )

    expect(
      screen.queryByTestId("stTooltipHoverTarget")
    ).not.toBeInTheDocument()
  })

  it("calls stopScript when clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.useFakeTimers()
    const stopScript = vi.fn()
    render(
      <StatusWidget
        {...getProps({ stopScript, scriptRunState: ScriptRunState.RUNNING })}
      />
    )

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
    const rerunScript = vi.fn()

    render(
      <StatusWidget
        {...getProps({
          rerunScript,
          scriptRunState: ScriptRunState.NOT_RUNNING,
          showScriptChangedActions: true,
        })}
      />
    )

    const buttons = await waitFor(
      () => {
        const foundButtons = screen.getAllByRole("button")
        expect(foundButtons).toHaveLength(2)
        return foundButtons
      },
      { timeout: 1000 }
    )

    expect(buttons[0]).toHaveTextContent("Rerun")
    expect(buttons[1]).toHaveTextContent("Always rerun")

    // Click "Rerun" button
    await user.click(buttons[0])

    expect(rerunScript).toHaveBeenCalledWith(false)
  })

  it("shows the always rerun button when script changes", async () => {
    const user = userEvent.setup()
    const rerunScript = vi.fn()

    render(
      <StatusWidget
        {...getProps({
          rerunScript,
          scriptRunState: ScriptRunState.NOT_RUNNING,
          showScriptChangedActions: true,
        })}
      />
    )

    const buttons = await waitFor(
      () => {
        const foundButtons = screen.getAllByRole("button")
        expect(foundButtons).toHaveLength(2)
        return foundButtons
      },
      { timeout: 1000 }
    )

    expect(buttons[0]).toHaveTextContent("Rerun")
    expect(buttons[1]).toHaveTextContent("Always rerun")

    // Click "Always Rerun" button
    await user.click(buttons[1])

    expect(rerunScript).toHaveBeenCalledWith(true)
  })

  it("does not show the always rerun button when script changes", async () => {
    const rerunScript = vi.fn()

    render(
      <StatusWidget
        {...getProps({
          rerunScript,
          scriptRunState: ScriptRunState.NOT_RUNNING,
          allowRunOnSave: false,
          showScriptChangedActions: true,
        })}
      />
    )

    const buttons = await waitFor(
      () => {
        const foundButtons = screen.getAllByRole("button")
        expect(foundButtons).toHaveLength(1)
        return foundButtons
      },
      { timeout: 1000 }
    )

    expect(buttons[0]).toHaveTextContent("Rerun")
  })

  it("calls always run on save", async () => {
    const user = userEvent.setup()
    const rerunScript = vi.fn()

    render(
      <StatusWidget
        {...getProps({
          rerunScript,
          scriptRunState: ScriptRunState.NOT_RUNNING,
          showScriptChangedActions: true,
        })}
      />
    )

    // Verify the Always rerun button is visible
    expect(
      await screen.findByText("Always rerun", {}, { timeout: 1000 })
    ).toBeVisible()

    // Click "Always rerun" button
    const alwaysRerunButton = screen.getByText("Always rerun")
    await user.click(alwaysRerunButton)

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

  it("renders regular running icon before New Years", async () => {
    vi.setSystemTime(new Date("December 30, 2022 23:59:00"))

    render(
      <StatusWidget
        {...getProps({ scriptRunState: ScriptRunState.RUNNING })}
      />
    )

    vi.runAllTimers()

    await waitFor(() => {
      const icon = screen.getByTestId("stStatusWidgetRunningManIcon")
      expect(icon).toBeVisible()
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
      const icon = screen.getByTestId("stStatusWidgetNewYearsIcon")
      expect(icon).toBeVisible()
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
      const icon = screen.getByTestId("stStatusWidgetNewYearsIcon")
      expect(icon).toBeVisible()
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
      const icon = screen.getByTestId("stStatusWidgetRunningManIcon")
      expect(icon).toBeVisible()
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
      const icon = screen.getByTestId("stStatusWidgetRunningManIcon")
      expect(icon).toBeVisible()
    })
  })
})
