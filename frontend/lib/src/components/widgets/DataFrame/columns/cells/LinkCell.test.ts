/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import { GridCellKind } from "@glideapps/glide-data-grid"
import { LinkCell, getLinkDisplayValue } from "./LinkCell"

describe("LinkCell", () => {
  function getMockLinkCell(href = "", displayText = ""): LinkCell {
    return {
      kind: GridCellKind.Custom,
      allowOverlay: true,
      copyData: "",
      readonly: false,
      data: {
        kind: "link-cell",
        href: href || "",
        displayText: displayText || "",
      },
    }
  }
  it("renders the href when displayText is empty", () => {
    const cell = getMockLinkCell("https://streamlit.io")

    const { href, displayText } = cell.data
    expect(getLinkDisplayValue(href, displayText)).toBe("https://streamlit.io")
  })

  it("renders the displayText value when its set and not a regexp", () => {
    const cell = getMockLinkCell("https://streamlit.io", "streamlit")

    const { href, displayText } = cell.data
    expect(getLinkDisplayValue(href, displayText)).toBe("streamlit")
  })

  it("renders the applied regex to the href when displayText is a regex", () => {
    const cell = getMockLinkCell(
      "https://roadmap.streamlit.app",
      "https://(.*?).streamlit.app"
    )

    const { href, displayText } = cell.data
    expect(getLinkDisplayValue(href, displayText)).toBe("roadmap")
  })

  it("renders the href when displayText is a regex but theres no match", () => {
    const cell = getMockLinkCell(
      "https://google.com",
      "https://(.*?).streamlit.app"
    )

    const { href, displayText } = cell.data
    expect(getLinkDisplayValue(href, displayText)).toBe("https://googles.com")
  })
})
