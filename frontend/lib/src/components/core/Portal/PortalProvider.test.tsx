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

import { render } from "~lib/test_util"

import { DATAFRAME_PORTAL_ID, FLOATING_OVERLAY_PORTAL_ID } from "./constants"
import { PortalProvider } from "./PortalProvider"

describe("PortalProvider", () => {
  it("mounts the dataframe overlay host tagged as a top layer overlay root", () => {
    render(
      <PortalProvider>
        <div>content</div>
      </PortalProvider>
    )

    const host = document.getElementById(DATAFRAME_PORTAL_ID)
    expect(host).not.toBeNull()
    expect(host).toHaveAttribute("data-react-aria-top-layer", "true")
    expect(host).toHaveAttribute("data-st-overlay-root", "true")
  })

  it("mounts the floating overlay host so popover-in-dialog widgets are interactable (fixes #16005)", () => {
    // The host must be a sibling of the dialog under `document.body` and
    // must carry `data-react-aria-top-layer` so React Aria's `ModalOverlay`
    // does not mark it (or its subtree) as `inert` when a dialog is open —
    // that is what makes widgets inside a popover-in-dialog unclickable.
    // It must also carry `data-st-overlay-root` so interacting with its
    // children does not dismiss the enclosing dialog or popover.
    render(
      <PortalProvider>
        <div>content</div>
      </PortalProvider>
    )

    const host = document.getElementById(FLOATING_OVERLAY_PORTAL_ID)
    expect(host).not.toBeNull()
    expect(host).toHaveAttribute("data-react-aria-top-layer", "true")
    expect(host).toHaveAttribute("data-st-overlay-root", "true")
    // The host lives directly under document.body so it is a sibling of the
    // dialog (not a descendant that inherits the dialog's inert subtree).
    expect(host?.parentElement).toBe(document.body)
  })
})
