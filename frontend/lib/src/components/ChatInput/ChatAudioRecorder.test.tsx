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

import React from "react"

import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { AudioMeta, WaveformController } from "~lib/components/audio"
import { render } from "~lib/test_util"

import ChatAudioRecorder from "src/components/ChatInput/ChatAudioRecorder"

describe("ChatAudioRecorder", () => {
  const baseMeta: AudioMeta = {
    durationMs: 1000,
    sampleRate: 16000,
    mimeType: "audio/webm",
    size: 1024,
  }

  const createController = ({
    startImplementation,
  }: {
    startImplementation?: () => Promise<void>
  } = {}): WaveformController => {
    const mountRef = { current: document.createElement("div") }

    return {
      state: "idle",
      isPlaybackPlaying: false,
      mountRef,
      start: vi.fn(startImplementation ?? (() => Promise.resolve())),
      stop: vi.fn().mockResolvedValue({
        blob: new Blob(["fake"], { type: "audio/webm" }),
        meta: baseMeta,
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
  }

  it("starts recording when isRecording becomes true and handles failures by cancelling", async () => {
    const onCancel = vi.fn()
    const onStart = vi.fn()
    const controller = createController({
      startImplementation: () => Promise.reject(new Error("mic")),
    })

    const { rerender, unmount } = render(
      <ChatAudioRecorder
        controller={controller}
        isRecording={false}
        onStart={onStart}
        onApprove={vi.fn()}
        onCancel={onCancel}
      />
    )

    // Should not start recording when isRecording is false
    expect(controller.start).not.toHaveBeenCalled()

    // Re-render with isRecording true
    rerender(
      <ChatAudioRecorder
        controller={controller}
        isRecording={true}
        onStart={onStart}
        onApprove={vi.fn()}
        onCancel={onCancel}
      />
    )

    await waitFor(() => expect(controller.start).toHaveBeenCalled())
    await waitFor(() => expect(onCancel).toHaveBeenCalled())
    unmount()
    expect(controller.destroy).toHaveBeenCalled()
  })

  it("cancels recording and notifies parent", async () => {
    const onCancel = vi.fn()
    const onStart = vi.fn()
    const controller = createController()

    render(
      <ChatAudioRecorder
        controller={controller}
        isRecording={true}
        onStart={onStart}
        onApprove={vi.fn()}
        onCancel={onCancel}
      />
    )

    await waitFor(() => expect(controller.start).toHaveBeenCalled())

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }))

    expect(controller.cancel).toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalled()
  })

  it("approves recording and sends blob/meta payload", async () => {
    const onApprove = vi.fn()
    const onStart = vi.fn()
    const controller = createController()

    render(
      <ChatAudioRecorder
        controller={controller}
        isRecording={true}
        onStart={onStart}
        onApprove={onApprove}
        onCancel={vi.fn()}
      />
    )

    await waitFor(() => expect(controller.start).toHaveBeenCalled())

    await userEvent.click(screen.getByRole("button", { name: /approve/i }))

    expect(controller.stop).toHaveBeenCalledTimes(1)
    expect(onApprove).toHaveBeenCalledWith({
      blob: expect.any(Blob),
      meta: baseMeta,
    })
  })

  it("exposes accessible labels", async () => {
    const controller = createController()

    render(
      <ChatAudioRecorder
        controller={controller}
        isRecording={true}
        onStart={vi.fn()}
        onApprove={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    await waitFor(() => expect(controller.start).toHaveBeenCalled())
    const group = screen.getByRole("group", { name: /recording/i })
    expect(group).toBeVisible()
    expect(screen.getByRole("button", { name: /cancel/i })).toBeVisible()
    expect(screen.getByRole("button", { name: /approve/i })).toBeVisible()
  })

  it("does not render UI when isRecording is false", () => {
    const controller = createController()

    render(
      <ChatAudioRecorder
        controller={controller}
        isRecording={false}
        onStart={vi.fn()}
        onApprove={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    // Should not show buttons when not recording
    expect(
      screen.queryByRole("button", { name: /cancel/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /approve/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("group")).not.toBeInTheDocument()
  })
})
