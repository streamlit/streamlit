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
import React from "react"

import { GridCellKind } from "@glideapps/glide-data-grid"
import { LinkCell, linkCellRenderer } from "./LinkCell"

describe("LinkCell", () => {
  function getMockLinkCell(href = ""): LinkCell {
    return {
      kind: GridCellKind.Custom,
      allowOverlay: true,
      copyData: "",
      readonly: false,
      data: {
        kind: "link-cell",
        href: href || "",
        displayText: "",
      },
    }
  }

  // todo(bhay) add some rendering tests here?
  it("creates a valid linkCellRenderer", () => {
    expect(linkCellRenderer).not.toBeUndefined()
  })

  it("matches the cell correctly", () => {
    expect(linkCellRenderer.isMatch(getMockLinkCell())).toBe(true)
  })
})
