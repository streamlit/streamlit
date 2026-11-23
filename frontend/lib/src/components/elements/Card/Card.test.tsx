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

import { Block as BlockProto } from "@streamlit/protobuf"

import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { mockTheme } from "~lib/mocks/mockTheme"
import { mockEllipsizedLabels, render } from "~lib/test_util"

import Card, { type CardProps } from "./Card"

const getProps = (
  elementProps: Partial<BlockProto.Card> = {},
  props: Partial<CardProps> = {}
): CardProps => ({
  element: BlockProto.Card.create({
    label: "Revenue",
    border: true,
    background: false,
    ...elementProps,
  }),
  hasFixedHeight: false,
  hasStretchHeight: true,
  isStale: false,
  headerExtras: null,
  actions: null,
  body: <div>body</div>,
  ...props,
})

describe("Card", () => {
  it("is a group named by its label and described by its caption", () => {
    render(<Card {...getProps({ caption: "Last 12 months" })} />)

    const card = screen.getByRole("group", { name: "Revenue" })
    expect(card).toBe(screen.getByTestId("stCard"))
    expect(card).toHaveAccessibleDescription("Last 12 months")
    expect(card).toHaveClass("stCard")
  })

  it("names the group from the rendered label text, not its Markdown", () => {
    render(<Card {...getProps({ label: "**Bold** :red[label]" })} />)

    expect(screen.getByRole("group")).toHaveAccessibleName("Bold label")
  })

  it("has no description and no caption element without a caption", () => {
    render(<Card {...getProps()} />)

    expect(screen.getByTestId("stCard")).not.toHaveAttribute(
      "aria-describedby"
    )
    expect(screen.queryByTestId("stCardCaption")).not.toBeInTheDocument()
  })

  it("is not a heading and is not focusable", () => {
    render(<Card {...getProps()} />)

    expect(screen.queryByRole("heading")).not.toBeInTheDocument()
    expect(screen.getByTestId("stCard")).not.toHaveAttribute("tabindex")
  })

  it("renders a help icon only when help is set", () => {
    const { unmount } = render(<Card {...getProps()} />)
    expect(
      screen.queryByRole("button", { name: /help/i })
    ).not.toBeInTheDocument()
    unmount()

    render(<Card {...getProps({ help: "More details" })} />)
    expect(screen.getByRole("button", { name: /help/i })).toBeVisible()
  })

  it("keeps the icon out of the accessible name", () => {
    render(<Card {...getProps({ icon: ":material/payments:" })} />)

    expect(screen.getByRole("group")).toHaveAccessibleName("Revenue")
  })

  describe("slots", () => {
    it("renders the extras, actions, and body", () => {
      render(
        <Card
          {...getProps(
            {},
            {
              headerExtras: <span>extras</span>,
              actions: <button type="button">act</button>,
            }
          )}
        />
      )

      expect(screen.getByText("extras")).toBeVisible()
      expect(screen.getByRole("button", { name: "act" })).toBeVisible()
      expect(screen.getByText("body")).toBeVisible()
    })

    it("renders no actions wrapper for an empty actions slot", () => {
      render(<Card {...getProps()} />)

      expect(screen.queryByTestId("stCardActions")).not.toBeInTheDocument()
      expect(screen.getByTestId("stCardHeader")).toBeVisible()
    })

    it("renders only the header for an empty body", () => {
      render(<Card {...getProps({}, { body: null })} />)

      expect(screen.getByTestId("stCardHeader")).toBeVisible()
      expect(screen.queryByText("body")).not.toBeInTheDocument()
    })
  })

  describe("surface", () => {
    it.each([
      ["outlined", true, false],
      ["filled with outline", true, true],
      ["filled without outline", false, true],
    ])("draws a frame for a %s card", (_name, border, background) => {
      render(<Card {...getProps({ border, background })} />)

      expect(screen.getByTestId("stCard")).toHaveStyle({
        borderRadius: mockTheme.emotion.radii.default,
      })
    })

    it("draws the outline in the border color only with a border", () => {
      const { unmount } = render(
        <Card {...getProps({ border: true, background: false })} />
      )
      expect(screen.getByTestId("stCard")).toHaveStyle({
        borderColor: mockTheme.emotion.colors.borderColor,
      })
      unmount()

      render(<Card {...getProps({ border: false, background: true })} />)
      expect(screen.getByTestId("stCard")).toHaveStyle({
        borderColor: "transparent",
      })
    })

    it("has no frame or padding without border and background", () => {
      render(<Card {...getProps({ border: false, background: false })} />)

      const card = screen.getByTestId("stCard")
      expect(card).not.toHaveStyle({
        borderRadius: mockTheme.emotion.radii.default,
      })
      expect(getComputedStyle(card).padding).toBe("")
      expect(getComputedStyle(card).borderStyle).toBe("")
    })

    it("paints the secondary background and swaps it for the contents", () => {
      const ThemeProbe = (): React.ReactElement => {
        const theme = useEmotionTheme()
        return (
          <div data-testid="probe">
            {theme.colors.bgColor}|{theme.colors.secondaryBg}
          </div>
        )
      }
      const { bgColor, secondaryBg } = mockTheme.emotion.colors

      render(
        <Card {...getProps({ background: true }, { body: <ThemeProbe /> })} />
      )

      expect(screen.getByTestId("stCard")).toHaveStyle({
        backgroundColor: secondaryBg,
      })
      expect(screen.getByTestId("probe")).toHaveTextContent(
        `${secondaryBg}|${bgColor}`
      )
    })

    it("swaps the backgrounds back for a nested filled card", () => {
      const ThemeProbe = (): React.ReactElement => {
        const theme = useEmotionTheme()
        return (
          <div data-testid="probe">
            {theme.colors.bgColor}|{theme.colors.secondaryBg}
          </div>
        )
      }
      const { bgColor, secondaryBg } = mockTheme.emotion.colors
      const inner = (
        <Card {...getProps({ background: true }, { body: <ThemeProbe /> })} />
      )

      render(<Card {...getProps({ background: true }, { body: inner })} />)

      expect(screen.getByTestId("probe")).toHaveTextContent(
        `${bgColor}|${secondaryBg}`
      )
    })

    it("keeps the theme for the contents without a background", () => {
      const ThemeProbe = (): React.ReactElement => {
        const theme = useEmotionTheme()
        return <div data-testid="probe">{theme.colors.bgColor}</div>
      }

      render(<Card {...getProps({}, { body: <ThemeProbe /> })} />)

      expect(screen.getByTestId("probe")).toHaveTextContent(
        mockTheme.emotion.colors.bgColor
      )
    })
  })

  describe("height", () => {
    it("scrolls only the body for an integer height", () => {
      render(<Card {...getProps({}, { hasFixedHeight: true })} />)

      const scrollBody = screen.getByTestId("stCardScrollBody")
      expect(scrollBody).toContainElement(screen.getByText("body"))
      expect(scrollBody).not.toContainElement(
        screen.getByTestId("stCardHeader")
      )
      expect(scrollBody).toHaveStyle("overflow-y: auto")
    })

    it.each([
      ["stretch", true],
      ["content", false],
    ])("has no scroll wrapper for %s height", (_name, hasStretchHeight) => {
      render(<Card {...getProps({}, { hasStretchHeight })} />)

      expect(screen.queryByTestId("stCardScrollBody")).not.toBeInTheDocument()
    })
  })

  describe("truncation", () => {
    mockEllipsizedLabels(200, 100)

    it("shows the full label as a title when it is clipped", () => {
      render(<Card {...getProps({ label: "A **long** label" })} />)

      expect(screen.getByTestId("stCardLabel")).toHaveAttribute(
        "title",
        "A long label"
      )
    })
  })

  it("fades the border of a stale card", () => {
    render(<Card {...getProps({}, { isStale: true })} />)

    expect(screen.getByTestId("stCard")).toHaveStyle({
      borderColor: mockTheme.emotion.colors.borderColorLight,
    })
  })
})
