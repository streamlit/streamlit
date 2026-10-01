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

import { Info } from "@emotion-icons/material-outlined"
import { act, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { render } from "~lib/test_util"

import { TOP_DISTANCE } from "./styled-components"
import Toolbar, {
  ToolbarAction,
  type ToolbarActionProps,
  type ToolbarProps,
} from "./Toolbar"

const onExpand = vi.fn()
const onCollapse = vi.fn()

const getToolbarProps = (
  propOverrides: Partial<ToolbarProps> = {}
): ToolbarProps => ({
  onExpand: onExpand,
  onCollapse: onCollapse,
  isFullScreen: false,
  locked: true,
  ...propOverrides,
})

const getToolbarActionsProps = (
  propOverrides: Partial<ToolbarActionProps> = {}
): ToolbarActionProps => ({
  onClick: vi.fn(),
  icon: Info,
  label: "info",
  show_label: false,
  ...propOverrides,
})

describe("Toolbar element", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders a Toolbar", () => {
    render(
      <Toolbar {...getToolbarProps()}>
        <ToolbarAction {...getToolbarActionsProps()} />
      </Toolbar>
    )

    const toolbar = screen.getByTestId("stElementToolbar")
    expect(toolbar).toBeInTheDocument()
    expect(toolbar).toBeVisible()
    expect(toolbar).toHaveClass("stElementToolbar")

    // Check if toolbar buttons are rendered:
    const toolbarButton = screen.getAllByTestId("stElementToolbarButton")
    expect(toolbarButton).toHaveLength(2)
  })

  it("styles toolbar & buttons correctly", () => {
    render(<Toolbar {...getToolbarProps()} />)

    const toolbar = screen.getByTestId("stElementToolbar")
    // Check positioning of toolbar
    expect(toolbar).toHaveStyle(`top: ${TOP_DISTANCE}`)

    // Check styling of toolbar
    const toolbarButtonContainer = screen.getByTestId(
      "stElementToolbarButtonContainer"
    )
    expect(toolbarButtonContainer).toHaveStyle("padding: 0.25rem")
    expect(toolbarButtonContainer).toHaveStyle("color: rgba(49, 51, 63, 0.6)")
  })

  it("doesn't show toolbar if not locked", () => {
    render(
      <Toolbar {...getToolbarProps({ locked: false })}>
        <ToolbarAction {...getToolbarActionsProps()} />
      </Toolbar>
    )

    const toolbar = screen.getByTestId("stElementToolbar")
    expect(toolbar).toBeInTheDocument()
    // Should not be visible
    expect(toolbar).not.toBeVisible()
  })

  it("allows expanding into fullscreen mode", async () => {
    const user = userEvent.setup()
    render(
      <Toolbar {...getToolbarProps()}>
        <ToolbarAction {...getToolbarActionsProps()} />
      </Toolbar>
    )

    const toolbar = screen.getByTestId("stElementToolbar")
    expect(toolbar).toBeInTheDocument()
    // Toolbar is always visible in fullscreen:
    expect(toolbar).toBeVisible()

    const toolbarButton = screen.getAllByRole("button")
    expect(toolbarButton).toHaveLength(2)
    // Clicking the second button should close the fullscreen mode
    await user.click(toolbarButton[1])

    // Check that onCollapse was clicked
    expect(onExpand).toHaveBeenCalled()
  })

  it("adapts to fullscreen mode", async () => {
    const user = userEvent.setup()
    render(
      <Toolbar {...getToolbarProps({ locked: false, isFullScreen: true })}>
        <ToolbarAction {...getToolbarActionsProps()} />
      </Toolbar>
    )

    const toolbar = screen.getByTestId("stElementToolbar")
    expect(toolbar).toBeInTheDocument()
    // Toolbar is always visible in fullscreen:
    expect(toolbar).toBeVisible()

    const toolbarButton = screen.getAllByRole("button")
    expect(toolbarButton).toHaveLength(2)
    // Clicking the second button should close the fullscreen mode
    await user.click(toolbarButton[1])

    // Check that onCollapse was clicked
    expect(onCollapse).toHaveBeenCalled()
  })

  it("deactivates fullscreen mode via props", () => {
    render(
      <Toolbar
        {...getToolbarProps({ locked: false, disableFullscreenMode: true })}
      >
        <ToolbarAction {...getToolbarActionsProps()} />
      </Toolbar>
    )

    // Check that there is only one toolbar button.
    // The fullscreen actions should not be visible.
    const toolbarButton = screen.getAllByTestId("stElementToolbarButton")
    expect(toolbarButton).toHaveLength(1)
  })

  it("uses a plain Fullscreen aria-label when labelContext is omitted", () => {
    render(<Toolbar {...getToolbarProps()} />)

    expect(
      screen.getByRole("button", { name: /^Fullscreen$/ })
    ).toBeInTheDocument()
  })

  it("composes labelContext into the Fullscreen aria-label but not the tooltip", async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<Toolbar {...getToolbarProps({ labelContext: "Revenue table" })} />)

    const fullscreen = screen.getByRole("button", {
      name: /^Fullscreen: Revenue table$/,
    })
    expect(fullscreen).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Fullscreen$/ })
    ).not.toBeInTheDocument()

    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltipTarget)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    // Tooltip stays the short action label.
    expect(screen.getByTestId("stTooltipContent")).toHaveTextContent(
      "Fullscreen"
    )
  })

  it("composes labelContext into the Close fullscreen aria-label", () => {
    render(
      <Toolbar
        {...getToolbarProps({
          isFullScreen: true,
          labelContext: "Revenue table",
        })}
      />
    )

    expect(
      screen.getByRole("button", {
        name: /^Close fullscreen: Revenue table$/,
      })
    ).toBeInTheDocument()
  })
})

describe("ToolbarAction Button element", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders correctly", () => {
    render(<ToolbarAction {...getToolbarActionsProps()} />)
    // Check if toolbar button is rendered:
    const toolbarButton = screen.getByTestId("stElementToolbarButton")
    expect(toolbarButton).toBeInTheDocument()

    // Check if the toolbar icon is shown:
    const toolbarButtonIcon = screen.getByTestId("stElementToolbarButtonIcon")
    expect(toolbarButtonIcon).toBeInTheDocument()
  })

  it("shows a label if show_labe=true", () => {
    render(<ToolbarAction {...getToolbarActionsProps({ show_label: true })} />)
    // Check that the info label is visible
    const infoLabel = screen.getByText("info")
    expect(infoLabel).toBeVisible()
  })

  it("doesn't show an icon if icon=undefined", () => {
    render(
      <ToolbarAction
        {...getToolbarActionsProps({ show_label: true, icon: undefined })}
      />
    )
    // Check that the info label is visible
    const infoLabel = screen.getByText("info")
    expect(infoLabel).toBeVisible()

    // Check if the toolbar icon is not shown:
    const toolbarButtonIcon = screen.queryByTestId(
      "stElementToolbarButtonIcon"
    )
    expect(toolbarButtonIcon).toBeNull()
  })

  it("calls callback on click", async () => {
    const user = userEvent.setup()
    const onClickMock = vi.fn()

    render(
      <ToolbarAction {...getToolbarActionsProps({ onClick: onClickMock })} />
    )
    // Check if toolbar button is rendered:
    const toolbarButton = screen.getByRole("button")
    expect(toolbarButton).toBeInTheDocument()

    await user.click(toolbarButton)

    // Check that onClick callback was clicked
    expect(onClickMock).toHaveBeenCalled()
  })

  it("hides its tooltip when the action is no longer hovered", async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<ToolbarAction {...getToolbarActionsProps()} />)

    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltipTarget)
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByTestId("stTooltipContent")).toHaveTextContent("info")

    await user.unhover(tooltipTarget)

    expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()
  })

  it("hides its tooltip when the action is clicked", async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onClickMock = vi.fn()

    render(
      <ToolbarAction {...getToolbarActionsProps({ onClick: onClickMock })} />
    )

    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltipTarget)
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByTestId("stTooltipContent")).toHaveTextContent("info")

    await user.click(screen.getByRole("button", { name: /^info$/ }))

    expect(onClickMock).toHaveBeenCalled()
    expect(screen.queryByTestId("stTooltipContent")).not.toBeInTheDocument()
  })

  it("composes labelContext into aria-label while keeping the tooltip short", async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(
      <ToolbarAction
        {...getToolbarActionsProps({
          label: "Download as CSV",
          labelContext: "Revenue table",
        })}
      />
    )

    expect(
      screen.getByRole("button", {
        name: /^Download as CSV: Revenue table$/,
      })
    ).toBeInTheDocument()

    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    await user.hover(tooltipTarget)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByTestId("stTooltipContent")).toHaveTextContent(
      "Download as CSV"
    )
  })

  it("meets the 24px minimum target size", () => {
    render(<ToolbarAction {...getToolbarActionsProps()} />)

    // Asserts the CSS rule is present (jsdom does not resolve max() to a used
    // pixel value). Playwright snapshots cover the rendered WCAG 2.5.8 size.
    const button = screen.getByRole("button", { name: /^info$/ })
    expect(button).toHaveStyle("min-width: max(1.5rem, 24px)")
    expect(button).toHaveStyle("min-height: max(1.5rem, 24px)")
  })
})
