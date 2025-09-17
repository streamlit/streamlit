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

import React, { Fragment } from "react"

import { screen } from "@testing-library/react"

import { StreamlitDialog } from "@streamlit/app/src/components/StreamlitDialog"
import { DialogType } from "@streamlit/app/src/components/StreamlitDialog/constants"
import { render } from "@streamlit/lib"

function flushPromises(): Promise<void> {
  return new Promise(process.nextTick)
}

describe("StreamlitDialog", () => {
  it("renders clear cache dialog and focuses clear cache button", async () => {
    render(
      <Fragment>
        {StreamlitDialog({
          type: DialogType.CLEAR_CACHE,
          confirmCallback: () => {},
          defaultAction: () => {},
          onClose: () => {},
        })}
      </Fragment>
    )

    // Flush promises to give componentDidMount() a chance to run.
    await flushPromises()

    const buttons = await screen.findAllByRole("button")
    const targetButton = buttons[1]
    expect(targetButton).toHaveTextContent("Clear caches")
    expect(targetButton).toHaveFocus()
  })

  it("renders secondary dialog buttons properly", async () => {
    render(
      <Fragment>
        {StreamlitDialog({
          type: DialogType.CLEAR_CACHE,
          confirmCallback: () => {},
          defaultAction: () => {},
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
          defaultAction: () => {},
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
