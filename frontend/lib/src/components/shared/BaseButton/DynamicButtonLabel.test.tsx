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

import { screen, waitFor } from "@testing-library/react"
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

  it("applies truncate styles to the label when wrap is false", () => {
    render(<DynamicButtonLabel {...getProps({ wrap: false })} />)
    expect(screen.getByTestId("stMarkdownContainer")).toHaveStyle({
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
    })
  })

  it("does not truncate the label by default (wrap=true)", () => {
    render(<DynamicButtonLabel {...getProps()} />)
    expect(screen.getByTestId("stMarkdownContainer")).not.toHaveStyle({
      "text-overflow": "ellipsis",
    })
  })

  it("keeps the icon and shortcut visible when wrap is false", () => {
    render(
      <DynamicButtonLabel {...getProps({ wrap: false, shortcut: "ctrl+k" })} />
    )
    expect(screen.getByTestId("stIconEmoji")).toBeVisible()
    expect(screen.getByText("Ctrl + K")).toBeVisible()
    expect(screen.getByTestId("stMarkdownContainer")).toHaveTextContent(
      "Button Label"
    )
  })

  it("adds a native title tooltip with the full label when enabled", () => {
    render(<DynamicButtonLabel {...getProps({ addTitleTooltip: true })} />)
    expect(screen.getByTitle("Button Label")).toBeVisible()
  })

  it("uses the plain text of a Markdown label for the title", () => {
    render(
      <DynamicButtonLabel
        {...getProps({ label: "**Bold** report", addTitleTooltip: true })}
      />
    )
    // The title is the rendered plain text, not the raw Markdown source.
    expect(screen.getByTitle("Bold report")).toBeVisible()
    expect(screen.queryByTitle("**Bold** report")).not.toBeInTheDocument()
  })

  it("re-syncs the title when markdown DOM content changes asynchronously", async () => {
    render(
      <DynamicButtonLabel
        {...getProps({ label: "First label", addTitleTooltip: true })}
      />
    )
    expect(screen.getByTitle("First label")).toBeVisible()

    // Simulate a late Markdown plugin paint (e.g. emoji shortcodes) that
    // replaces skeleton/empty content without changing React props.
    const markdown = screen.getByTestId("stMarkdownContainer")
    const textHost = markdown.querySelector("p") ?? markdown
    textHost.textContent = "Updated plain text"

    await waitFor(() => {
      expect(screen.getByTitle("Updated plain text")).toBeVisible()
    })
    expect(screen.queryByTitle("First label")).not.toBeInTheDocument()
  })

  it("does not set a title by default", () => {
    render(<DynamicButtonLabel {...getProps()} />)
    expect(screen.queryByTitle("Button Label")).not.toBeInTheDocument()
  })
})
