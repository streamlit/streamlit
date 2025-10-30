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

import React, { useEffect } from "react"

import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { render } from "~lib/test_util"

import ChatComposer from "src/components/ChatInput/ChatComposer"

const controllerMock = {
  state: "idle" as const,
  isPlaybackPlaying: false,
  mountRef: { current: document.createElement("div") },
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue({
    blob: new Blob(["audio"], { type: "audio/webm" }),
    meta: {
      durationMs: 1200,
      sampleRate: 16000,
      mimeType: "audio/webm",
      size: 2048,
    },
  }),
  approve: vi.fn(),
  cancel: vi.fn(),
  destroy: vi.fn(),
  playback: {
    isPlaying: vi.fn().mockReturnValue(false),
    play: vi.fn(),
    pause: vi.fn(),
    load: vi.fn(),
    getCurrentTimeMs: vi.fn().mockReturnValue(0),
    getDurationMs: vi.fn().mockReturnValue(0),
  },
  setEventHandlers: vi.fn(),
}

vi.mock("~lib/components/audio", () => ({
  useWaveformController: vi.fn(() => controllerMock),
}))

function MockChatAudioRecorder({
  onCancel,
  onApprove,
  controller,
  disabled,
}: {
  onCancel: () => void
  onApprove: ({ blob, meta }: { blob: Blob; meta: unknown }) => void
  controller: typeof controllerMock
  disabled?: boolean
}): React.ReactElement {
  useEffect(() => {
    void controller.start()
  }, [controller])

  return (
    <div data-testid="mock-recorder">
      <button
        type="button"
        onClick={onCancel}
        disabled={disabled}
        data-testid="mock-recorder-cancel"
      >
        cancel
      </button>
      <button
        type="button"
        onClick={() =>
          onApprove({
            blob: new Blob(["audio"], { type: "audio/webm" }),
            meta: {
              durationMs: 1200,
              sampleRate: 16000,
              mimeType: "audio/webm",
              size: 2048,
            },
          })
        }
        disabled={disabled}
        data-testid="mock-recorder-approve"
      >
        approve
      </button>
    </div>
  )
}

vi.mock("../ChatAudioRecorder", () => ({
  __esModule: true,
  default: MockChatAudioRecorder,
}))

describe("ChatComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("hides mic button when acceptAudio is false", () => {
    const sendChatSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ChatComposer sendChatSubmit={sendChatSubmit} />)

    expect(screen.queryByTestId("chat-composer-mic")).not.toBeInTheDocument()
  })

  it("enters recording mode and disables controls when mic is clicked", async () => {
    const sendChatSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ChatComposer sendChatSubmit={sendChatSubmit} acceptAudio />)

    const textarea = screen.getByTestId("chat-composer-input")
    await userEvent.type(textarea, "hello")

    const micButton = screen.getByTestId("chat-composer-mic")
    await userEvent.click(micButton)

    expect(screen.getByTestId("chat-composer")).toHaveClass(
      "stChatComposer--recording"
    )
    expect(textarea).toBeDisabled()
    expect(screen.getByTestId("chat-composer-send")).toBeDisabled()
    expect(screen.getByTestId("chat-composer-attach")).toBeDisabled()
    expect(screen.getByTestId("mock-recorder")).toBeVisible()
  })

  it("returns focus to input when recording is cancelled", async () => {
    const sendChatSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ChatComposer sendChatSubmit={sendChatSubmit} acceptAudio />)

    const textarea = screen.getByTestId("chat-composer-input")
    const micButton = screen.getByTestId("chat-composer-mic")

    await userEvent.click(micButton)
    await userEvent.click(screen.getByTestId("mock-recorder-cancel"))

    await waitFor(() => expect(textarea).toHaveFocus())
  })

  it("submits audio payload on approve and resets focus", async () => {
    const sendChatSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ChatComposer sendChatSubmit={sendChatSubmit} acceptAudio />)

    const textarea = screen.getByTestId("chat-composer-input")
    await userEvent.type(textarea, "Message body")

    await userEvent.click(screen.getByTestId("chat-composer-mic"))
    await userEvent.click(screen.getByTestId("mock-recorder-approve"))

    await waitFor(() => {
      expect(sendChatSubmit).toHaveBeenCalledWith({
        text: "Message body",
        files: [],
        audio: expect.objectContaining({
          name: "chat-audio.webm",
          type: "audio/webm",
        }),
      })
    })

    await waitFor(() => expect(textarea).toHaveFocus())
  })
})
