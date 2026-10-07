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

import type { CSSProperties, ReactElement } from "react"

import { screen, waitFor } from "@testing-library/react"

import { mockEllipsizedLabels, render } from "~lib/test_util"

import {
  MARKDOWN_ELLIPSIS_CLASS,
  useLabelTitleTooltip,
} from "./useLabelTitleTooltip"

const ELLIPSIS_STYLE: CSSProperties = {
  display: "block",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
}

interface HarnessProps {
  addTitleTooltip: boolean
  label: string
  /** Optional rendered label content (simulates Markdown plain text). */
  labelContent?: string
  /** When false, the label box overflows without painting an ellipsis. */
  ellipsis?: boolean
}

function LabelTitleHarness({
  addTitleTooltip,
  label,
  labelContent,
  ellipsis = true,
}: HarnessProps): ReactElement {
  const { titleRef, labelTextRef } = useLabelTitleTooltip(
    addTitleTooltip,
    label
  )

  return (
    <div
      ref={titleRef}
      data-testid="title-host"
      style={ellipsis ? ELLIPSIS_STYLE : undefined}
    >
      <span ref={labelTextRef} data-testid="label-text">
        {labelContent ?? label}
      </span>
    </div>
  )
}

function MissingLabelHarness(): ReactElement {
  const { titleRef } = useLabelTitleTooltip(true, "Unused")
  return <div ref={titleRef} data-testid="title-host" />
}

describe("useLabelTitleTooltip", () => {
  const layout = mockEllipsizedLabels()

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

  it("inserts spaces between leftover paragraphs and hard breaks in the title", () => {
    function BlockGapHarness(): ReactElement {
      const { titleRef, labelTextRef } = useLabelTitleTooltip(true, "one two")
      return (
        <div ref={titleRef} data-testid="title-host" style={ELLIPSIS_STYLE}>
          <span ref={labelTextRef} data-testid="label-text">
            <p>one</p>
            <p>two</p>
            <br />
            three
          </span>
        </div>
      )
    }

    render(<BlockGapHarness />)

    expect(screen.getByTitle("one two three")).toBeVisible()
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

  it("does not set a title when the rendered label text is empty", () => {
    render(
      <LabelTitleHarness addTitleTooltip={true} label="" labelContent="" />
    )

    expect(screen.getByTestId("title-host")).not.toHaveAttribute("title")
  })

  it("does not set a title when the label text node is missing", () => {
    render(<MissingLabelHarness />)

    expect(screen.getByTestId("title-host")).not.toHaveAttribute("title")
  })

  it("does not set a title when the label is fully visible", () => {
    layout.setWidths(100, 100)
    render(<LabelTitleHarness addTitleTooltip={true} label="Plain label" />)

    expect(screen.queryByTitle("Plain label")).not.toBeInTheDocument()
  })

  it("ignores a 1px overflow and treats a larger overflow as clipped", () => {
    layout.setWidths(101, 100)
    const { unmount } = render(
      <LabelTitleHarness addTitleTooltip={true} label="Plain label" />
    )
    expect(screen.queryByTitle("Plain label")).not.toBeInTheDocument()

    unmount()
    layout.setWidths(102, 100)
    render(<LabelTitleHarness addTitleTooltip={true} label="Plain label" />)
    expect(screen.getByTitle("Plain label")).toBeVisible()
  })

  it("does not set a title when the box overflows without an ellipsis", () => {
    render(
      <LabelTitleHarness
        addTitleTooltip={true}
        label="Plain label"
        ellipsis={false}
      />
    )

    expect(screen.queryByTitle("Plain label")).not.toBeInTheDocument()
  })

  it("reads ellipsis from a descendant when the text wrapper has no box", () => {
    function ContentsHarness(): ReactElement {
      const { titleRef, labelTextRef } = useLabelTitleTooltip(true, "Clipped")
      return (
        <div ref={titleRef} data-testid="title-host">
          <span ref={labelTextRef} style={{ display: "contents" }}>
            <span className={MARKDOWN_ELLIPSIS_CLASS} style={ELLIPSIS_STYLE}>
              Clipped
            </span>
          </span>
        </div>
      )
    }

    render(<ContentsHarness />)

    expect(screen.getByTitle("Clipped")).toBeVisible()
  })

  it("measures a hidden label once it is laid out, then stops watching size", () => {
    const observers: Array<{
      callback: ResizeObserverCallback
      disconnect: ReturnType<typeof vi.fn>
    }> = []
    class ResizeObserverSpy {
      public observe = vi.fn()
      public unobserve = vi.fn()
      public disconnect = vi.fn()

      constructor(callback: ResizeObserverCallback) {
        observers.push({ callback, disconnect: this.disconnect })
      }
    }

    const OriginalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = ResizeObserverSpy

    try {
      layout.setWidths(0, 0)
      render(<LabelTitleHarness addTitleTooltip={true} label="Plain label" />)
      expect(screen.queryByTitle("Plain label")).not.toBeInTheDocument()
      expect(observers).toHaveLength(1)

      layout.setWidths(200, 100)
      observers[0].callback([], {} as ResizeObserver)
      expect(screen.getByTitle("Plain label")).toBeVisible()
      expect(observers[0].disconnect).toHaveBeenCalled()
    } finally {
      globalThis.ResizeObserver = OriginalResizeObserver
    }
  })

  it("remeasures overflow once document fonts finish loading", async () => {
    let resolveReady: () => void = () => undefined
    const ready = new Promise<void>(resolve => {
      resolveReady = resolve
    })
    const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts")
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready, status: "loading" },
    })

    try {
      layout.setWidths(100, 100)
      render(<LabelTitleHarness addTitleTooltip={true} label="Plain label" />)
      expect(screen.queryByTitle("Plain label")).not.toBeInTheDocument()

      layout.setWidths(200, 100)
      expect(screen.queryByTitle("Plain label")).not.toBeInTheDocument()

      resolveReady()
      await waitFor(() => {
        expect(screen.getByTitle("Plain label")).toBeVisible()
      })
    } finally {
      if (originalFonts) {
        Object.defineProperty(document, "fonts", originalFonts)
      } else {
        Reflect.deleteProperty(document, "fonts")
      }
    }
  })

  it("clears the title when fonts finish loading and the label fits", async () => {
    let resolveReady: () => void = () => undefined
    const ready = new Promise<void>(resolve => {
      resolveReady = resolve
    })
    const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts")
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready, status: "loading" },
    })

    try {
      layout.setWidths(200, 100)
      render(<LabelTitleHarness addTitleTooltip={true} label="Plain label" />)
      expect(screen.getByTitle("Plain label")).toBeVisible()

      layout.setWidths(100, 100)
      expect(screen.getByTitle("Plain label")).toBeVisible()

      resolveReady()
      await waitFor(() => {
        expect(screen.queryByTitle("Plain label")).not.toBeInTheDocument()
      })
    } finally {
      if (originalFonts) {
        Object.defineProperty(document, "fonts", originalFonts)
      } else {
        Reflect.deleteProperty(document, "fonts")
      }
    }
  })

  it("does not measure again when document fonts are already loaded", async () => {
    let resolveReady: () => void = () => undefined
    const ready = new Promise<void>(resolve => {
      resolveReady = resolve
    })
    const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts")
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready, status: "loaded" },
    })

    try {
      layout.setWidths(100, 100)
      render(<LabelTitleHarness addTitleTooltip={true} label="Plain label" />)

      layout.setWidths(200, 100)
      resolveReady()
      await ready

      expect(screen.queryByTitle("Plain label")).not.toBeInTheDocument()
    } finally {
      if (originalFonts) {
        Object.defineProperty(document, "fonts", originalFonts)
      } else {
        Reflect.deleteProperty(document, "fonts")
      }
    }
  })
})
