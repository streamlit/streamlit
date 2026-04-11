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

import { Fragment } from "react"

import { screen } from "@testing-library/react"

import { DialogType } from "@streamlit/app/src/components/StreamlitDialog/constants"
import { StreamlitDialog } from "@streamlit/app/src/components/StreamlitDialog/StreamlitDialog"
import { render } from "@streamlit/lib/testing"

function flushPromises(): Promise<void> {
  return new Promise(process.nextTick)
}

describe("StreamlitDialog", () => {
  it("renders clear cache dialog and focuses cancel button", async () => {
    render(
      <Fragment>
        {StreamlitDialog({
          type: DialogType.CLEAR_CACHE,
          confirmCallback: () => {},
          onClose: () => {},
        })}
      </Fragment>
    )

    // Flush promises to give componentDidMount() a chance to run.
    await flushPromises()

    // Per WAI-ARIA best practice for destructive confirmation dialogs,
    // focus should land on the non-destructive "Cancel" button.
    const cancelButton = await screen.findByText("Cancel")
    expect(cancelButton).toHaveFocus()
  })

  it("renders secondary dialog buttons properly", async () => {
    render(
      <Fragment>
        {StreamlitDialog({
          type: DialogType.CLEAR_CACHE,
          confirmCallback: () => {},
          onClose: () => {},
        })}
      </Fragment>
    )

    const baseButtonSecondary = await screen.findByTestId(
      "stBaseButton-secondary"
    )
    expect(baseButtonSecondary).toBeDefined()
  })

  it("renders tertiary dialog buttons properly", async () => {
    render(
      <Fragment>
        {StreamlitDialog({
          type: DialogType.CLEAR_CACHE,
          confirmCallback: () => {},
          onClose: () => {},
        })}
      </Fragment>
    )

    const baseButtonGhost = await screen.findByTestId("stBaseButton-ghost")
    expect(baseButtonGhost).toBeDefined()
  })
})

describe("aboutDialog", () => {
  it("shows aboutSectionMd content when provided", () => {
    render(
      <Fragment>
        {StreamlitDialog({
          type: DialogType.ABOUT,
          onClose: () => {},
          aboutSectionMd: "# This is a test about section",
        })}
      </Fragment>
    )

    expect(screen.getByTestId("stDialog")).toBeInTheDocument()
    expect(
      screen.getByText("This is a test about section")
    ).toBeInTheDocument()
  })
})
