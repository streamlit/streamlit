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
    render(<DynamicButtonLabel {...getProps()} />)
    const markdown = screen.getByTestId("stMarkdownContainer")
    const icon = screen.getByTestId("stIconEmoji")
    // Icon precedes the markdown label in document order.
    expect(
      icon.compareDocumentPosition(markdown) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("renders the icon to the right when requested", () => {
    render(<DynamicButtonLabel {...getProps({ iconPosition: "right" })} />)
    const markdown = screen.getByTestId("stMarkdownContainer")
    const icon = screen.getByTestId("stIconEmoji")
    // Markdown precedes the icon in document order when iconPosition is right.
    // (A display:contents wrapper around the markdown means firstElementChild
    // is not the stMarkdownContainer itself.)
    expect(
      markdown.compareDocumentPosition(icon) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
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
    const container = screen.getByTestId("stMarkdownContainer")
    expect(container).toHaveStyle({
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
      "line-height": "inherit",
    })
    expect(screen.getByText("Button Label")).toHaveStyle({
      "line-height": "inherit",
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
