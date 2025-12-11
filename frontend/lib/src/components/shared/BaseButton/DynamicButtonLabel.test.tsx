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
import { vi } from "vitest"

import { render } from "~lib/test_util"
import * as utils from "~lib/util/utils"

import {
  DynamicButtonLabel,
  DynamicButtonLabelProps,
} from "./DynamicButtonLabel"

const getProps = (
  propOverrides: Partial<DynamicButtonLabelProps> = {}
): DynamicButtonLabelProps => ({
  icon: "😀",
  label: "Button Label",
  ...propOverrides,
})

describe("DynamicButtonLabel", () => {
  it("renders without crashing", () => {
    render(<DynamicButtonLabel {...getProps()} />)
    const buttonLabel = screen.getByText("Button Label")
    expect(buttonLabel).toBeInTheDocument()
  })

  it("renders label with no icon", () => {
    render(<DynamicButtonLabel {...getProps({ icon: "" })} />)
    expect(screen.getByTestId("stMarkdownContainer")).toHaveTextContent(
      "Button Label"
    )
    expect(screen.queryByTestId("stIconEmoji")).toBeNull()
  })

  it("renders icon with no label", () => {
    render(<DynamicButtonLabel {...getProps({ label: "" })} />)
    expect(screen.getByTestId("stIconEmoji")).toHaveTextContent("😀")
    expect(screen.queryByTestId("stMarkdownContainer")).toBeNull()
  })

  it("renders an emoji icon", () => {
    render(<DynamicButtonLabel {...getProps()} />)

    const icon = screen.getByTestId("stIconEmoji")
    expect(icon).toHaveTextContent("😀")
  })

  it("renders a material icon", () => {
    render(
      <DynamicButtonLabel {...getProps({ icon: ":material/thumb_up:" })} />
    )

    const icon = screen.getByTestId("stIconMaterial")
    expect(icon).toHaveTextContent("thumb_up")
  })

  it("positions the icon to the left by default", () => {
    const { container } = render(<DynamicButtonLabel {...getProps()} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper).toBeDefined()
    const mainLabel = wrapper.querySelector('[data-has-shortcut="false"]')
    expect(mainLabel).toBeDefined()
    expect(mainLabel?.firstElementChild).not.toHaveAttribute(
      "data-testid",
      "stMarkdownContainer"
    )
  })

  it("renders the icon to the right when requested", () => {
    const { container } = render(
      <DynamicButtonLabel {...getProps({ iconPosition: "right" })} />
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper).toBeDefined()
    const mainLabel = wrapper.querySelector('[data-has-shortcut="false"]')
    expect(mainLabel).toBeDefined()
    expect(mainLabel?.firstElementChild).toHaveAttribute(
      "data-testid",
      "stMarkdownContainer"
    )
  })

  it("renders shortcut text when provided", () => {
    const shortcut = "ctrl+k"

    render(<DynamicButtonLabel {...getProps({ shortcut })} />)

    expect(screen.getByText("Ctrl + K")).toBeInTheDocument()
  })

  it("maps Cmd shortcut to Ctrl on non-mac platforms", () => {
    const spy = vi.spyOn(utils, "isFromMac").mockReturnValue(false)
    const shortcut = "cmd+n"

    render(<DynamicButtonLabel {...getProps({ shortcut })} />)

    expect(screen.getByText("Ctrl + N")).toBeInTheDocument()
    spy.mockRestore()
  })
})
