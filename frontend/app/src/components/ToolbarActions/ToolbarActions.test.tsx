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

import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import { mockSessionInfo, render } from "@streamlit/lib"

import ToolbarActions, {
  ActionButton,
  ActionButtonProps,
  ToolbarActionsProps,
} from "./ToolbarActions"

describe("ActionButton", () => {
  const getProps = (
    extended?: Partial<ActionButtonProps>
  ): ActionButtonProps => ({
    label: "the label",
    icon: "star.svg",
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
    render(<ActionButton {...getProps({ label: undefined })} />)

    expect(screen.getByTestId("stToolbarActionButton")).toBeInTheDocument()
    expect(
      screen.queryByTestId("stToolbarActionButtonLabel")
    ).not.toBeInTheDocument()
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

    const favoriteButton = screen.getAllByTestId("stBaseButton-header")[0]
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
})
