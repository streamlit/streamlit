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

import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import { type IToolbarItem, mockSessionInfo } from "@streamlit/lib"
import { render } from "@streamlit/lib/testing"

import ToolbarActions, {
  ActionButton,
  type ActionButtonProps,
  getToolbarActionAccessibleName,
  type ToolbarActionsProps,
} from "./ToolbarActions"

describe("getToolbarActionAccessibleName", () => {
  it.each([
    {
      label: "Share",
      key: "share",
      expected: "Share",
    },
    {
      label: "  Share  ",
      key: "share",
      expected: "Share",
    },
    {
      label: "   ",
      key: "favorite",
      expected: "favorite",
    },
    {
      label: undefined,
      key: "favorite",
      expected: "favorite",
    },
    {
      label: undefined,
      key: "  ",
      expected: "Toolbar action",
    },
    {
      label: undefined,
      key: undefined,
      expected: "Toolbar action",
    },
    {
      // Runtime host payloads may still send non-strings via postMessage.
      label: 1 as unknown as string,
      key: { id: "x" } as unknown as string,
      expected: "Toolbar action",
    },
  ])(
    "returns $expected for label=$label key=$key",
    ({ label, key, expected }) => {
      expect(getToolbarActionAccessibleName(label, key)).toBe(expected)
    }
  )
})

describe("ActionButton", () => {
  const getProps = (
    extended?: Partial<ActionButtonProps>
  ): ActionButtonProps => ({
    label: "the label",
    icon: "star.svg",
    itemKey: "the-label",
    onClick: vi.fn(),
    ...extended,
  })

  it("renders without crashing", () => {
    render(<ActionButton {...getProps()} />)

    expect(screen.getByTestId("stToolbarActionButton")).toBeInTheDocument()
  })

  it("does not render icon if not provided", () => {
    render(<ActionButton {...getProps({ icon: undefined })} />)

    expect(screen.getByTestId("stToolbarActionButton")).toBeInTheDocument()
    expect(
      screen.queryByTestId("stToolbarActionButtonIcon")
    ).not.toBeInTheDocument()
  })

  it("does not render label if not provided", () => {
    render(
      <ActionButton {...getProps({ label: undefined, itemKey: "favorite" })} />
    )

    expect(screen.getByTestId("stToolbarActionButton")).toBeInTheDocument()
    expect(
      screen.queryByTestId("stToolbarActionButtonLabel")
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "favorite" })).toBeVisible()
  })
})

describe("ToolbarActions", () => {
  const getProps = (
    extended?: Partial<ToolbarActionsProps>
  ): ToolbarActionsProps => ({
    hostToolbarItems: [
      { key: "favorite", icon: "star.svg" },
      { key: "share", label: "Share" },
    ],
    sendMessageToHost: vi.fn(),
    metricsMgr: new MetricsManager(mockSessionInfo()),
    ...extended,
  })

  it("renders without crashing", () => {
    render(<ToolbarActions {...getProps()} />)
    expect(screen.getByTestId("stToolbarActions")).toBeInTheDocument()
  })

  it("renders toolbar actions and renders action buttons horizontally", () => {
    render(<ToolbarActions {...getProps()} />)
    expect(screen.getByTestId("stToolbarActions")).toHaveStyle("display: flex")
  })

  it("calls sendMessageToHost with correct args when clicked", async () => {
    const user = userEvent.setup()
    const props = getProps()
    render(<ToolbarActions {...props} />)

    const favoriteButton = screen.getByRole("button", { name: "favorite" })
    await user.click(favoriteButton)
    expect(props.sendMessageToHost).toHaveBeenLastCalledWith({
      type: "TOOLBAR_ITEM_CALLBACK",
      key: "favorite",
    })

    const shareButton = screen.getByRole("button", { name: "Share" })
    await user.click(shareButton)
    expect(props.sendMessageToHost).toHaveBeenLastCalledWith({
      type: "TOOLBAR_ITEM_CALLBACK",
      key: "share",
    })
  })

  it("uses distinct key fallbacks for multiple icon-only actions", () => {
    render(
      <ToolbarActions
        {...getProps({
          hostToolbarItems: [
            { key: "favorite", icon: "star.svg", label: "   " },
            { key: "download", icon: "download.svg" },
          ],
        })}
      />
    )

    expect(screen.getByRole("button", { name: "favorite" })).toBeVisible()
    expect(screen.getByRole("button", { name: "download" })).toBeVisible()
    expect(
      screen.queryByTestId("stToolbarActionButtonLabel")
    ).not.toBeInTheDocument()
  })

  it("falls back to a generic name when a host item key is missing or non-string", () => {
    render(
      <ToolbarActions
        {...getProps({
          hostToolbarItems: [
            { icon: "star.svg" } as IToolbarItem,
            { key: 123 as unknown as string, icon: "star.svg" },
          ],
        })}
      />
    )

    const buttons = screen.getAllByRole("button", { name: "Toolbar action" })
    expect(buttons).toHaveLength(2)
  })

  it("does not set aria-label when a visible label is present", () => {
    render(<ToolbarActions {...getProps()} />)

    const shareButton = screen.getByRole("button", { name: "Share" })
    expect(shareButton).not.toHaveAttribute("aria-label")
  })
})
