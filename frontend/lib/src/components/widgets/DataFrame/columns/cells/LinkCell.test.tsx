/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import * as React from "react"
import { GridCellKind } from "@glideapps/glide-data-grid"
import { LinkCell, LinkCellProps, linkCellRenderer } from "./LinkCell"
import { screen } from "@testing-library/react"
import { render } from "@streamlit/lib/src/test_util"
import "@testing-library/jest-dom"

const LINK_CELL_TEST_ID = "stLinkCell"

describe("LinkCell", () => {
  function getMockLinkCell(
    href = "",
    display_text = "",
    props: Partial<LinkCell> = {}
  ): LinkCell {
    return {
      ...props,
      kind: GridCellKind.Custom,
      allowOverlay: true,
      copyData: href,
      readonly: props.readonly || false,
      data: {
        kind: "link-cell",
        href: href,
        displayText: display_text,
      },
    }
  }

  it("creates a valid linkCellRenderer", () => {
    expect(linkCellRenderer).not.toBeUndefined()
  })

  it("matches the cell correctly", () => {
    expect(linkCellRenderer.isMatch(getMockLinkCell())).toBe(true)
  })

  it("renders into the dom with correct value", async () => {
    const cell = getMockLinkCell("https://streamlit.io", "", {
      readonly: true,
    })
    const Editor = linkCellRenderer.provideEditor?.(cell)

    render(
      // @ts-expect-error
      <Editor isHighlighted={false} value={cell} forceEditMode={false} />
    )

    await screen.findByTestId(LINK_CELL_TEST_ID)
    const linkCell = screen.getByTestId(LINK_CELL_TEST_ID)

    // check if url value is correct
    expect(linkCell).toHaveAttribute("href", "https://streamlit.io")

    // check that the displayed text is correct
    expect(linkCell).toHaveTextContent("https://streamlit.io")
  })

  it("should render the displayText", async () => {
    const cell = getMockLinkCell("https://streamlit.io", "Click here", {
      readonly: true,
    })
    const Editor = linkCellRenderer.provideEditor?.(cell)

    render(
      // @ts-expect-error
      <Editor isHighlighted={false} value={cell} />
    )

    const element = screen.getByTestId(LINK_CELL_TEST_ID)

    expect(element).toHaveTextContent("Click here")
  })

  it("should allow pasting in an href value", async () => {
    const cell = getMockLinkCell("https://streamlit.io")
    // @ts-expect-error
    const value = linkCellRenderer.onPaste(
      "https://pasted-link.com",
      cell.data
    ) as LinkCellProps

    expect(value.href).toStrictEqual("https://pasted-link.com")
  })
})
