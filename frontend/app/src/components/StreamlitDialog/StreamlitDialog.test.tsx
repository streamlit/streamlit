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
import { userEvent } from "@testing-library/user-event"

import { DialogType } from "@streamlit/app/src/components/StreamlitDialog/constants"
import { StreamlitDialog } from "@streamlit/app/src/components/StreamlitDialog/StreamlitDialog"
import { render } from "@streamlit/lib/testing"

function flushPromises(): Promise<void> {
  return new Promise(process.nextTick)
}

function renderDialog(props: Parameters<typeof StreamlitDialog>[0]): void {
  render(<Fragment>{StreamlitDialog(props)}</Fragment>)
}

function renderDeployErrorDialog(options?: {
  onContinue?: ReturnType<typeof vi.fn>
}): {
  onClose: ReturnType<typeof vi.fn>
  onContinue?: ReturnType<typeof vi.fn>
  onTryAgain: ReturnType<typeof vi.fn>
} {
  const onClose = vi.fn()
  const onTryAgain = vi.fn()
  const onContinue = options?.onContinue

  renderDialog({
    type: DialogType.DEPLOY_ERROR,
    title: "Deploy failed",
    msg: "Something went wrong",
    onClose,
    onTryAgain,
    onContinue,
  } as Parameters<typeof StreamlitDialog>[0])

  return { onClose, onContinue, onTryAgain }
}

describe("StreamlitDialog", () => {
  it("renders clear cache dialog and focuses cancel button", async () => {
    renderDialog({
      type: DialogType.CLEAR_CACHE,
      confirmCallback: () => {},
      onClose: () => {},
    })

    // Flush promises to give componentDidMount() a chance to run.
    await flushPromises()

    // Per WAI-ARIA best practice for destructive confirmation dialogs,
    // focus should land on the non-destructive "Cancel" button.
    const cancelButton = await screen.findByText("Cancel")
    expect(cancelButton).toHaveFocus()
  })

  it("renders secondary dialog buttons properly", async () => {
    renderDialog({
      type: DialogType.CLEAR_CACHE,
      confirmCallback: () => {},
      onClose: () => {},
    })

    const baseButtonSecondary = await screen.findByTestId(
      "stBaseButton-secondary"
    )
    expect(baseButtonSecondary).toBeDefined()
  })

  it("renders tertiary dialog buttons properly", async () => {
    renderDialog({
      type: DialogType.CLEAR_CACHE,
      confirmCallback: () => {},
      onClose: () => {},
    })

    const baseButtonGhost = await screen.findByTestId("stBaseButton-ghost")
    expect(baseButtonGhost).toBeDefined()
  })

  it("renders a closed modal when type is undefined", () => {
    renderDialog({
      type: undefined,
      onClose: () => {},
    } as unknown as Parameters<typeof StreamlitDialog>[0])

    expect(screen.queryByTestId("stDialog")).not.toBeInTheDocument()
  })

  it("shows an unrecognized type message for unknown dialog types", () => {
    renderDialog({
      type: "notARealDialog",
      onClose: () => {},
    } as unknown as Parameters<typeof StreamlitDialog>[0])

    expect(
      screen.getByText('Dialog type "notARealDialog" not recognized.')
    ).toBeVisible()
  })
})

describe("aboutDialog", () => {
  it("shows aboutSectionMd content when provided", () => {
    renderDialog({
      type: DialogType.ABOUT,
      onClose: () => {},
      aboutSectionMd: "# This is a test about section",
    })

    expect(screen.getByTestId("stDialog")).toBeVisible()
    expect(screen.getByText("This is a test about section")).toBeVisible()
  })
})

describe("DeployErrorDialog", () => {
  it("shows Close when onContinue is not provided", () => {
    renderDeployErrorDialog()

    expect(screen.getByText("Deploy failed")).toBeVisible()
    expect(screen.getByText("Something went wrong")).toBeVisible()
    // Prefer text over role: the modal chrome also has an icon button
    // with aria-label "Close".
    expect(screen.getByText("Close")).toBeVisible()
    expect(screen.queryByText("Continue anyway")).not.toBeInTheDocument()
  })

  it("shows Continue anyway when onContinue is provided", () => {
    renderDeployErrorDialog({ onContinue: vi.fn() })

    expect(screen.getByText("Continue anyway")).toBeVisible()
    expect(screen.queryByText("Close")).not.toBeInTheDocument()
  })

  it("calls onClose when Close is clicked", async () => {
    const user = userEvent.setup()
    const { onClose, onTryAgain } = renderDeployErrorDialog()

    await user.click(screen.getByText("Close"))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onTryAgain).not.toHaveBeenCalled()
  })

  it("calls onClose and onContinue when Continue anyway is clicked", async () => {
    const user = userEvent.setup()
    const onContinue = vi.fn()
    const { onClose, onTryAgain } = renderDeployErrorDialog({ onContinue })

    await user.click(screen.getByText("Continue anyway"))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(onTryAgain).not.toHaveBeenCalled()
  })

  it("calls onTryAgain when Try again is clicked", async () => {
    const user = userEvent.setup()
    const { onClose, onTryAgain } = renderDeployErrorDialog()

    await user.click(screen.getByRole("button", { name: "Try again" }))

    expect(onTryAgain).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })
})
