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

import { ReactElement } from "react"

import { screen, waitFor } from "@testing-library/react"

import { render } from "~lib/test_util"

import { useLabelTitleTooltip } from "./useLabelTitleTooltip"

interface HarnessProps {
  addTitleTooltip: boolean
  label: string
  /** Optional rendered label content (simulates Markdown plain text). */
  labelContent?: string
}

function LabelTitleHarness({
  addTitleTooltip,
  label,
  labelContent,
}: HarnessProps): ReactElement {
  const { titleRef, labelTextRef } = useLabelTitleTooltip(
    addTitleTooltip,
    label
  )

  return (
    <div ref={titleRef} data-testid="title-host">
      <span ref={labelTextRef} data-testid="label-text">
        {labelContent ?? label}
      </span>
    </div>
  )
}

describe("useLabelTitleTooltip", () => {
  it("sets a native title from the rendered label text when enabled", () => {
    render(
      <LabelTitleHarness
        addTitleTooltip={true}
        label="**Bold** label"
        labelContent="Bold label"
      />
    )

    expect(screen.getByTitle("Bold label")).toBeVisible()
    // Title uses DOM plain text, not the raw Markdown source.
    expect(screen.queryByTitle("**Bold** label")).not.toBeInTheDocument()
  })

  it("does not set a title when disabled", () => {
    render(<LabelTitleHarness addTitleTooltip={false} label="Plain label" />)

    expect(screen.queryByTitle("Plain label")).not.toBeInTheDocument()
  })

  it("removes the title and stops observing when addTitleTooltip flips to false", () => {
    const observe = vi.fn()
    // disconnect() clears the stored callback so a later fire() is a no-op, matching
    // a real MutationObserver after teardown. If cleanup skipped disconnect, fire()
    // would still invoke syncTitle and re-attach the title.
    let mutationCallback: MutationCallback | undefined
    const disconnect = vi.fn(() => {
      mutationCallback = undefined
    })
    const OriginalMutationObserver = globalThis.MutationObserver

    class MockMutationObserver {
      public observe = observe
      public disconnect = disconnect

      constructor(callback: MutationCallback) {
        mutationCallback = callback
      }
    }

    globalThis.MutationObserver =
      MockMutationObserver as unknown as typeof MutationObserver

    try {
      const { rerender } = render(
        <LabelTitleHarness addTitleTooltip={true} label="Plain label" />
      )

      expect(screen.getByTitle("Plain label")).toBeVisible()
      expect(observe).toHaveBeenCalled()

      rerender(
        <LabelTitleHarness addTitleTooltip={false} label="Plain label" />
      )

      expect(screen.queryByTitle("Plain label")).not.toBeInTheDocument()
      expect(disconnect).toHaveBeenCalled()

      // A late DOM mutation must not re-attach a title after the observer is gone.
      screen.getByTestId("label-text").textContent = "Updated label"
      mutationCallback?.([], {} as MutationObserver)
      expect(screen.queryByTitle("Updated label")).not.toBeInTheDocument()
    } finally {
      globalThis.MutationObserver = OriginalMutationObserver
    }
  })

  it("re-syncs the title when observed label DOM content changes", async () => {
    render(<LabelTitleHarness addTitleTooltip={true} label="First label" />)

    expect(screen.getByTitle("First label")).toBeVisible()

    screen.getByTestId("label-text").textContent = "Updated plain text"

    await waitFor(() => {
      expect(screen.getByTitle("Updated plain text")).toBeVisible()
    })
    expect(screen.queryByTitle("First label")).not.toBeInTheDocument()
  })
})
