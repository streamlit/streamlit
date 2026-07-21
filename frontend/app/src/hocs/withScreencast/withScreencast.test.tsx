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

import { FC, PureComponent, ReactElement } from "react"

import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"

import ScreenCastRecorder from "@streamlit/app/src/util/ScreenCastRecorder"
import { render } from "@streamlit/lib/testing"

import withScreencast, { ScreenCastHOC, Steps } from "./withScreencast"

vi.mock("@streamlit/app/src/util/ScreenCastRecorder")

interface TestProps {
  screenCast: ScreenCastHOC
  testOverride?: Steps

  /**
   * A property that's not related to the withScreencast wrapper.
   * We test that the wrapper passes unrelated props to its wrapped component.
   */
  unrelatedProp: string
}

class TestComponent extends PureComponent<TestProps> {
  public override render = (): ReactElement => (
    <>
      <div>{this.props.unrelatedProp}</div>
      <div>{this.props.screenCast ? "Screencast" : "Undefined"}</div>
    </>
  )
}

const WrappedTestComponent = withScreencast(TestComponent)

/**
 * A test component that surfaces the injected `screenCast` API as buttons and
 * text so tests can drive the recording state machine like a real consumer.
 */
const ControlComponent: FC<{ screenCast: ScreenCastHOC }> = ({
  screenCast,
}) => (
  <div>
    <div data-testid="current-state">{screenCast.currentState}</div>
    <button onClick={() => screenCast.startRecording("my-screencast")}>
      start
    </button>
    <button onClick={() => void screenCast.stopRecording()}>stop</button>
    <button onClick={() => screenCast.toggleRecordAudio()}>
      toggle-audio
    </button>
  </div>
)

const WrappedControlComponent = withScreencast(ControlComponent)

describe("withScreencast HOC", () => {
  it("renders without crashing", () => {
    render(<WrappedTestComponent unrelatedProp={"mockLabel"} />)
    expect(screen.getByTestId("stScreencast")).toBeInTheDocument()
  })

  it("wrapped component should have screenCast prop", () => {
    render(<WrappedTestComponent unrelatedProp={"mockLabel"} />)
    expect(screen.getByText("Screencast")).toBeInTheDocument()
  })

  it("passes other props to wrapped component", () => {
    render(<WrappedTestComponent unrelatedProp={"mockLabel"} />)
    expect(screen.getByText("mockLabel")).toBeInTheDocument()
  })

  it("defines displayName", () => {
    render(<WrappedTestComponent unrelatedProp={"mockLabel"} />)
    expect(WrappedTestComponent.displayName).toBe(
      "withScreencast(TestComponent)"
    )
  })

  describe("Steps", () => {
    it("shows a configuration dialog before start recording", () => {
      render(
        <WrappedTestComponent
          unrelatedProp={"mockLabel"}
          testOverride={"SETUP"}
        />
      )
      expect(screen.getByTestId("stScreencastInstruction")).toBeInTheDocument()
    })

    it("shows a countdown after setup", () => {
      render(
        <WrappedTestComponent
          unrelatedProp={"mockLabel"}
          testOverride={"COUNTDOWN"}
        />
      )
      expect(screen.getByTestId("stCountdown")).toBeInTheDocument()
    })

    it("shows an unsupported dialog when it's an unsupported browser", () => {
      render(
        <WrappedTestComponent
          unrelatedProp={"mockLabel"}
          testOverride={"UNSUPPORTED"}
        />
      )
      expect(
        screen.getByTestId("stUnsupportedBrowserDialog")
      ).toBeInTheDocument()
    })
  })

  describe("recording state machine", () => {
    const mockedRecorder = vi.mocked(ScreenCastRecorder)
    let user: ReturnType<typeof userEvent.setup>

    beforeEach(() => {
      user = userEvent.setup()
      mockedRecorder.isSupportedBrowser.mockReset()
      vi.mocked(ScreenCastRecorder.prototype.initialize).mockReset()
      vi.mocked(ScreenCastRecorder.prototype.start).mockReset()
      vi.mocked(ScreenCastRecorder.prototype.stop).mockReset()
      vi.mocked(ScreenCastRecorder.prototype.getState).mockReset()
    })

    const renderControl = (): void => {
      render(<WrappedControlComponent />)
    }

    const clickButton = async (label: string): Promise<void> => {
      await user.click(screen.getByText(label))
    }

    /** Open the setup dialog and confirm it to kick off the recording flow. */
    const beginRecording = async (): Promise<void> => {
      await clickButton("start")
      await clickButton("Start recording!")
    }

    /** Drive the 3-second countdown to zero via its animation-end events. */
    const advanceCountdown = (): void => {
      for (let i = 0; i < 3; i++) {
        fireEvent.animationEnd(screen.getByTestId("stCountdown"))
      }
    }

    /** Mock a supported browser whose recorder reaches the given state. */
    const mockSupportedRecorder = ({
      start = true,
      getState = "recording",
      stopBlob,
    }: {
      start?: boolean
      getState?: string
      stopBlob?: Blob
    } = {}): void => {
      mockedRecorder.isSupportedBrowser.mockReturnValue(true)
      vi.mocked(ScreenCastRecorder.prototype.initialize).mockResolvedValue()
      vi.mocked(ScreenCastRecorder.prototype.start).mockReturnValue(start)
      vi.mocked(ScreenCastRecorder.prototype.getState).mockReturnValue(
        getState
      )
      if (stopBlob) {
        vi.mocked(ScreenCastRecorder.prototype.stop).mockReturnValue(
          Promise.resolve(stopBlob)
        )
      }
    }

    it("opens the setup dialog when startRecording is called in a supported browser", async () => {
      mockedRecorder.isSupportedBrowser.mockReturnValue(true)
      renderControl()

      expect(screen.getByTestId("current-state")).toHaveTextContent("OFF")
      await clickButton("start")

      expect(screen.getByTestId("current-state")).toHaveTextContent("SETUP")
      expect(screen.getByTestId("stScreencastInstruction")).toBeVisible()
      expect(
        screen.queryByTestId("stUnsupportedBrowserDialog")
      ).not.toBeInTheDocument()
    })

    it("shows the unsupported dialog when startRecording is called in an unsupported browser", async () => {
      mockedRecorder.isSupportedBrowser.mockReturnValue(false)
      renderControl()

      await clickButton("start")

      expect(screen.getByTestId("stUnsupportedBrowserDialog")).toBeVisible()
      expect(
        screen.queryByTestId("stScreencastInstruction")
      ).not.toBeInTheDocument()
    })

    it("propagates a toggled audio preference into the setup dialog", async () => {
      mockedRecorder.isSupportedBrowser.mockReturnValue(true)
      renderControl()

      await clickButton("toggle-audio")
      await clickButton("start")

      expect(screen.getByRole("checkbox")).toBeChecked()
    })

    it("is a no-op when stopRecording is called before any recording starts", async () => {
      renderControl()

      await clickButton("stop")

      expect(screen.getByTestId("current-state")).toHaveTextContent("OFF")
    })

    it("stays in SETUP when startRecording is re-invoked with no active recorder", async () => {
      mockedRecorder.isSupportedBrowser.mockReturnValue(true)
      renderControl()

      await clickButton("start")
      expect(screen.getByTestId("current-state")).toHaveTextContent("SETUP")

      // Calling startRecording again while not OFF takes the "stop recording"
      // branch. With no active recorder that is a no-op, so state stays SETUP.
      await clickButton("start")
      expect(screen.getByTestId("current-state")).toHaveTextContent("SETUP")
    })

    it("does not start recording if the browser is unsupported when actually recording", async () => {
      // Supported when opening the dialog, but unsupported by the time the user
      // confirms the start. The dialog's onClose then returns the state to OFF.
      mockedRecorder.isSupportedBrowser
        .mockReturnValueOnce(true)
        .mockReturnValue(false)
      renderControl()

      await beginRecording()

      expect(screen.getByTestId("current-state")).toHaveTextContent("OFF")
      expect(
        screen.queryByTestId("stScreencastInstruction")
      ).not.toBeInTheDocument()
      expect(ScreenCastRecorder.prototype.initialize).not.toHaveBeenCalled()
    })

    it("switches to UNSUPPORTED if recorder initialization fails", async () => {
      mockedRecorder.isSupportedBrowser.mockReturnValue(true)
      vi.mocked(ScreenCastRecorder.prototype.initialize).mockRejectedValue(
        new Error("no permission")
      )
      renderControl()

      await beginRecording()

      // Initialization rejects asynchronously; flush pending microtasks so the
      // resulting state update is wrapped in act().
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      expect(
        await screen.findByTestId("stUnsupportedBrowserDialog")
      ).toBeVisible()
      expect(
        screen.queryByTestId("stScreencastInstruction")
      ).not.toBeInTheDocument()
    })

    it("runs the full setup -> countdown -> recording -> preview flow", async () => {
      const videoBlob = new Blob(["video"], { type: "video/webm" })
      mockSupportedRecorder({ getState: "recording", stopBlob: videoBlob })
      renderControl()

      await beginRecording()

      // Wait for the recorder to initialize and enter the countdown.
      await waitFor(() =>
        expect(screen.getByTestId("current-state")).toHaveTextContent(
          "COUNTDOWN"
        )
      )

      // Drive the countdown to zero to trigger the actual recording start.
      advanceCountdown()

      await waitFor(() =>
        expect(screen.getByTestId("current-state")).toHaveTextContent(
          "RECORDING"
        )
      )

      await clickButton("stop")

      expect(await screen.findByTestId("stVideoRecordedDialog")).toBeVisible()
    })

    it("returns to OFF when stopping a recorder that is already inactive", async () => {
      mockSupportedRecorder({ getState: "inactive" })
      renderControl()

      await beginRecording()
      await waitFor(() =>
        expect(screen.getByTestId("current-state")).toHaveTextContent(
          "COUNTDOWN"
        )
      )
      advanceCountdown()
      await waitFor(() =>
        expect(screen.getByTestId("current-state")).toHaveTextContent(
          "RECORDING"
        )
      )

      await clickButton("stop")

      await waitFor(() =>
        expect(screen.getByTestId("current-state")).toHaveTextContent("OFF")
      )
      expect(
        screen.queryByTestId("stVideoRecordedDialog")
      ).not.toBeInTheDocument()
    })

    it("returns to OFF if the recorder fails to start after the countdown", async () => {
      mockSupportedRecorder({ start: false })
      renderControl()

      await beginRecording()

      await waitFor(() =>
        expect(screen.getByTestId("current-state")).toHaveTextContent(
          "COUNTDOWN"
        )
      )

      advanceCountdown()

      await waitFor(() =>
        expect(screen.getByTestId("current-state")).toHaveTextContent("OFF")
      )
      expect(screen.queryByTestId("stCountdown")).not.toBeInTheDocument()
    })
  })
})
