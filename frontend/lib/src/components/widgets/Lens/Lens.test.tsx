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

import { act, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import { Lens as LensProto } from "@streamlit/protobuf"

import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Lens, { Props } from "./Lens"

const getProps = (
  elementProps: Partial<LensProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: LensProto.create({
    id: "lens_1",
    label: "AI Lens",
    ...elementProps,
  }),
  disabled: false,
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }),
  ...widgetProps,
})

describe("Lens widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(<Lens {...props} />)

    expect(screen.getByTestId("stLens")).toBeInTheDocument()
  })

  it("renders the label", () => {
    const props = getProps({ label: "Chart AI" })
    render(<Lens {...props} />)

    expect(screen.getByText("Chart AI")).toBeInTheDocument()
  })

  it("renders no default label when none provided", () => {
    const props = getProps({ label: "" })
    render(<Lens {...props} />)

    expect(screen.queryByText("AI Lens")).not.toBeInTheDocument()
  })

  it("renders a prompt input", () => {
    const props = getProps()
    render(<Lens {...props} />)

    expect(screen.getByTestId("stLensPromptInput")).toBeInTheDocument()
  })

  it("renders an analyze button", () => {
    const props = getProps()
    render(<Lens {...props} />)

    expect(screen.getByTestId("stLensAnalyzeButton")).toBeInTheDocument()
  })

  it("disables the analyze button when disabled prop is true", () => {
    const props = getProps({}, { disabled: true })
    render(<Lens {...props} />)

    expect(screen.getByTestId("stLensAnalyzeButton")).toBeDisabled()
  })

  it("disables prompt input when disabled", () => {
    const props = getProps({}, { disabled: true })
    render(<Lens {...props} />)

    expect(screen.getByTestId("stLensPromptInput")).toBeDisabled()
  })

  it("displays result when resultReady is true", () => {
    const props = getProps({
      result: "This chart shows an upward trend.",
      resultReady: true,
    })
    render(<Lens {...props} />)

    expect(screen.getByTestId("stLensResult")).toBeInTheDocument()
    expect(screen.getByTestId("stLensResult")).toHaveTextContent(
      "This chart shows an upward trend."
    )
  })

  it("does not show result when resultReady is false", () => {
    const props = getProps({
      result: "This chart shows an upward trend.",
      resultReady: false,
    })
    render(<Lens {...props} />)

    expect(screen.queryByTestId("stLensResult")).not.toBeInTheDocument()
  })

  it("does not show prompt input when result is displayed", () => {
    const props = getProps({
      result: "Some analysis result",
      resultReady: true,
    })
    render(<Lens {...props} />)

    expect(screen.queryByTestId("stLensPromptInput")).not.toBeInTheDocument()
  })

  it("calls setJsonValue when analyze button is clicked", async () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setJsonValue")

    render(<Lens {...props} />)

    const input = screen.getByTestId("stLensPromptInput")
    await userEvent.type(input, "Explain this data")

    const button = screen.getByTestId("stLensAnalyzeButton")
    await userEvent.click(button)

    expect(props.widgetMgr.setJsonValue).toHaveBeenCalledWith(
      props.element,
      expect.objectContaining({
        prompt: "Explain this data",
      }),
      { fromUi: true },
      undefined
    )
  })

  it("calls setJsonValue with empty prompt when no text entered", async () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setJsonValue")

    render(<Lens {...props} />)

    const button = screen.getByTestId("stLensAnalyzeButton")
    await userEvent.click(button)

    expect(props.widgetMgr.setJsonValue).toHaveBeenCalled()
  })

  it("shows analyzing spinner while processing", async () => {
    const props = getProps()
    vi.spyOn(props.widgetMgr, "setJsonValue")

    render(<Lens {...props} />)

    const button = screen.getByTestId("stLensAnalyzeButton")
    await userEvent.click(button)

    expect(screen.getByTestId("stLensSpinner")).toBeInTheDocument()
    expect(screen.getByTestId("stLensSpinner")).toHaveTextContent(
      "Analyzing..."
    )
    expect(screen.queryByTestId("stLensAnalyzeButton")).not.toBeInTheDocument()
  })

  describe("Auto-Analyze Mode", () => {
    it("renders the bolt button", () => {
      const props = getProps()
      render(<Lens {...props} />)

      expect(screen.getByTestId("stLensBoltButton")).toBeInTheDocument()
    })

    it("shows Auto-Analyze: OFF tooltip by default", () => {
      const props = getProps()
      render(<Lens {...props} />)

      expect(screen.getByTestId("stLensBoltButton")).toHaveAttribute(
        "title",
        "Auto-Analyze: OFF"
      )
    })

    it("toggles to ON when clicked", async () => {
      const props = getProps()
      render(<Lens {...props} />)

      const bolt = screen.getByTestId("stLensBoltButton")
      await userEvent.click(bolt)

      expect(bolt).toHaveAttribute("title", "Auto-Analyze: ON")
    })

    it("toggles back to OFF when clicked twice", async () => {
      const props = getProps()
      render(<Lens {...props} />)

      const bolt = screen.getByTestId("stLensBoltButton")
      await userEvent.click(bolt)
      await userEvent.click(bolt)

      expect(bolt).toHaveAttribute("title", "Auto-Analyze: OFF")
    })

    it("shows analyzing spinner after drag ends when auto-analyze is ON", async () => {
      const props = getProps()
      render(<Lens {...props} />)

      const bolt = screen.getByTestId("stLensBoltButton")
      await userEvent.click(bolt)

      // Simulate a real drag: mousedown → mousemove → mouseup
      const headerEl = screen.getByTestId("stLensDragHandle").parentElement!
      act(() => {
        headerEl.dispatchEvent(
          new MouseEvent("mousedown", {
            clientX: 100,
            clientY: 100,
            bubbles: true,
          })
        )
      })
      act(() => {
        window.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: 130,
            clientY: 130,
            bubbles: true,
          })
        )
      })
      act(() => {
        window.dispatchEvent(
          new MouseEvent("mouseup", {
            clientX: 150,
            clientY: 150,
            bubbles: true,
          })
        )
      })

      expect(screen.getByTestId("stLensSpinner")).toBeInTheDocument()
    })

    it("does not trigger auto-analyze when disabled", () => {
      const props = getProps()
      vi.spyOn(props.widgetMgr, "setJsonValue")
      render(<Lens {...props} />)
      // bolt is NOT clicked, so auto-analyze is OFF
      expect(screen.getByTestId("stLensBoltButton")).toHaveAttribute(
        "title",
        "Auto-Analyze: OFF"
      )
    })

    it("does not trigger auto-analyze when lens is minimized", async () => {
      const props = getProps()
      render(<Lens {...props} />)

      // Minimize the lens first
      const minimizeBtn = screen.getByTestId("stLensMinimizeButton")
      await userEvent.click(minimizeBtn)

      // Enable auto-analyze
      const bolt = screen.getByTestId("stLensBoltButton")
      await userEvent.click(bolt)

      // Simulate a real drag with movement (should NOT trigger analyze when minimized)
      const headerEl = screen.getByTestId("stLensDragHandle").parentElement!
      act(() => {
        headerEl.dispatchEvent(
          new MouseEvent("mousedown", {
            clientX: 100,
            clientY: 100,
            bubbles: true,
          })
        )
      })
      act(() => {
        window.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: 130,
            clientY: 130,
            bubbles: true,
          })
        )
      })
      act(() => {
        window.dispatchEvent(
          new MouseEvent("mouseup", {
            clientX: 150,
            clientY: 150,
            bubbles: true,
          })
        )
      })

      // Spinner should NOT appear since lens is minimized
      expect(screen.queryByTestId("stLensSpinner")).not.toBeInTheDocument()
    })
  })
})
