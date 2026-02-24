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

import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { vi } from "vitest"

import { LinkButton as LinkButtonProto } from "@streamlit/protobuf"

import { useRegisterShortcut } from "~lib/hooks/useRegisterShortcut"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import LinkButton, { Props } from "./LinkButton"

vi.mock("~lib/hooks/useRegisterShortcut", () => ({
  useRegisterShortcut: vi.fn(),
  formatShortcutForDisplay: vi.fn(
    (shortcut: string | null | undefined) =>
      shortcut?.replace(/\+/g, " + ") || undefined
  ),
}))

const getProps = (
  elementProps: Partial<LinkButtonProto> = {},
  widgetProps: Partial<Props> = {}
): Props => {
  const widgetMgr = new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  })
  vi.spyOn(widgetMgr, "setTriggerValue")

  return {
    element: LinkButtonProto.create({
      label: "Label",
      url: "https://streamlit.io",
      ...elementProps,
    }),
    widgetMgr,
    ...widgetProps,
  }
}

describe("LinkButton widget", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<LinkButton {...props} />)

    const linkButton = screen.getByRole("link")
    expect(linkButton).toBeInTheDocument()
  })

  it("has correct className", () => {
    const props = getProps()
    render(<LinkButton {...props} />)

    const linkButton = screen.getByTestId("stLinkButton")

    expect(linkButton).toHaveClass("stLinkButton")
  })

  it("renders a label within the button", () => {
    const props = getProps()
    render(<LinkButton {...props} />)

    const linkButton = screen.getByRole("link", {
      name: `${props.element.label}`,
    })

    expect(linkButton).toBeInTheDocument()
  })

  it("renders with help properly", async () => {
    const user = userEvent.setup()
    render(<LinkButton {...getProps({ help: "mockHelpText" })} />)

    // Ensure both the button and the tooltip target have the correct width
    // These will be 100% and the ElementContainer will have styles to determine
    // the button width.
    const linkButton = screen.getByRole("link")
    expect(linkButton).toHaveStyle("width: 100%")
    const tooltipTarget = screen.getByTestId("stTooltipHoverTarget")
    expect(tooltipTarget).toHaveStyle("width: 100%")

    // Ensure the tooltip content is visible and has the correct text
    await user.hover(tooltipTarget)

    const tooltipContent = await screen.findByTestId("stTooltipContent")
    expect(tooltipContent).toHaveTextContent("mockHelpText")
  })

  it("renders with shortcut label", () => {
    const props = getProps({ shortcut: "Ctrl+Enter" })
    render(<LinkButton {...props} />)

    // Check that the shortcut is displayed in the button
    // Note: The actual text might vary based on platform (e.g. Ctrl vs Cmd),
    // but DynamicButtonLabel handles that. For test environment, we assume defaults.
    const shortcutText = screen.getByText("Ctrl + Enter")
    expect(shortcutText).toBeVisible()
  })

  it("triggers the link click when shortcut is pressed", () => {
    const props = getProps({ shortcut: "Ctrl+Enter" })
    const useRegisterShortcutMock = vi.mocked(useRegisterShortcut)

    // Spy on the anchor click method to ensure it is called
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click")

    render(<LinkButton {...props} />)

    expect(useRegisterShortcutMock).toHaveBeenCalled()

    // Get the onActivate callback passed to the hook
    const { onActivate } = useRegisterShortcutMock.mock.calls[0][0]

    // Simulate the shortcut activation
    onActivate()

    expect(clickSpy).toHaveBeenCalled()

    clickSpy.mockRestore()
  })

  it("does not trigger rerun by default", async () => {
    const user = userEvent.setup()
    const props = getProps({ id: "link-id", ignoreRerun: true })
    render(<LinkButton {...props} />)

    await user.click(screen.getByRole("link"))

    expect(props.widgetMgr.setTriggerValue).not.toHaveBeenCalled()
  })

  it.each([
    ["without fragmentId", undefined],
    ["with fragmentId", "myFragmentId"],
  ])("triggers rerun %s", async (_, fragmentId) => {
    const user = userEvent.setup()
    const props = getProps(
      { id: "link-id", ignoreRerun: false },
      { fragmentId }
    )
    render(<LinkButton {...props} />)

    await user.click(screen.getByRole("link"))

    expect(props.widgetMgr.setTriggerValue).toHaveBeenCalledWith(
      props.element,
      { fromUi: true },
      fragmentId
    )
  })

  it("does not trigger rerun when disabled", async () => {
    const user = userEvent.setup()
    const props = getProps({
      id: "link-id",
      ignoreRerun: false,
      disabled: true,
    })
    render(<LinkButton {...props} />)

    await user.click(screen.getByRole("link"))

    expect(props.widgetMgr.setTriggerValue).not.toHaveBeenCalled()
  })

  describe("wrapped BaseLinkButton", () => {
    const LINK_BUTTON_TYPES = ["primary", "secondary", "tertiary"]

    LINK_BUTTON_TYPES.forEach(type => {
      it(`renders ${type} link button correctly`, () => {
        render(<LinkButton {...getProps({ type })} />)

        const linkButton = screen.getByTestId(`stBaseLinkButton-${type}`)
        expect(linkButton).toBeInTheDocument()
      })

      it(`renders disabled ${type} correctly`, () => {
        render(<LinkButton {...getProps({ type, disabled: true })} />)

        const linkButton = screen.getByRole("link")
        expect(linkButton).toHaveAttribute("disabled")
      })
    })
  })
})
