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

import React, { Fragment } from "react"
import { SessionInfo, mockSessionInfo, render } from "@streamlit/lib"
import { StreamlitDialog, DialogType } from "./StreamlitDialog"
import { waitFor, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

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

    await waitFor(() => {
      const buttons = screen.getAllByRole("button")
      const targetButton = buttons[1]

      expect(targetButton).toHaveTextContent("Clear caches")
    })
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
      "baseButton-secondary"
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

    const baseButtonSecondary = await screen.findByTestId(
      "baseButton-tertiary"
    )
    expect(baseButtonSecondary).toBeDefined()
  })
})

describe("aboutDialog", () => {
  it("shows version string if SessionInfo is initialized", async () => {
    render(
      <Fragment>
        {StreamlitDialog({
          type: DialogType.ABOUT,
          sessionInfo: mockSessionInfo({ streamlitVersion: "42.42.42" }),
          onClose: () => {},
        })}
      </Fragment>
    )

    const versionRegex = /Streamlit v\s*42\.42\.42/
    const versionText = screen.getByText(versionRegex)
    expect(versionText).toBeDefined()
  })

  it("shows no version string if SessionInfo is not initialized", async () => {
    const sessionInfo = new SessionInfo()
    expect(sessionInfo.isSet).toBe(false)

    render(
      <Fragment>
        {StreamlitDialog({
          type: DialogType.ABOUT,
          sessionInfo,
          onClose: () => {},
        })}
      </Fragment>
    )

    // regex that is anything after Streamlit v
    const versionRegex = /^Streamlit v.*/
    const nonExistentText = screen.queryByText(versionRegex)
    expect(nonExistentText).not.toBeInTheDocument()
  })
})
