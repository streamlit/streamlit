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

import { act, screen, waitFor } from "@testing-library/react"

import { AudioInput as AudioInputProto } from "@streamlit/protobuf"

import type {
  RecordingState,
  WaveformController,
  WaveformControllerEvents,
} from "~lib/components/audio"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import AudioInput, { Props } from "./AudioInput"

const useWaveformControllerMock = vi.fn()

vi.mock("~lib/components/audio", () => ({
  useWaveformController: (...args: unknown[]) =>
    useWaveformControllerMock(...args),
}))

const createWidgetMgr = (): WidgetStateManager =>
  new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  })

const createUploadClient = (): Props["uploadClient"] =>
  ({
    uploadFile: vi.fn(),
    fetchFileURLs: vi.fn().mockResolvedValue([]),
    deleteFile: vi.fn(),
  }) as unknown as Props["uploadClient"]

const createProps = (
  elementOverrides: Partial<AudioInputProto> = {},
  propOverrides: Partial<Props> = {}
): Props => ({
  element: AudioInputProto.create({
    id: "audio-input",
    label: "Audio Input",
    formId: "",
    ...elementOverrides,
  }),
  uploadClient: createUploadClient(),
  widgetMgr: createWidgetMgr(),
  disabled: false,
  fragmentId: undefined,
  ...propOverrides,
})

describe("AudioInput timer display", () => {
  let controllerState: RecordingState
  let isPlaybackPlaying: boolean
  let controller: WaveformController
  let latestEvents: WaveformControllerEvents | undefined

  const createController = (): WaveformController => ({
    get state() {
      return controllerState
    },
    get isPlaybackPlaying() {
      return isPlaybackPlaying
    },
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(new Blob()),
    approve: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn(),
    playback: {
      isPlaying: vi.fn().mockImplementation(() => isPlaybackPlaying),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      load: vi.fn().mockResolvedValue(undefined),
      getCurrentTimeMs: vi.fn().mockReturnValue(0),
      getDurationMs: vi.fn().mockReturnValue(0),
    },
    setEventHandlers: vi.fn(),
  })

  beforeEach(() => {
    controllerState = "idle"
    isPlaybackPlaying = false
    controller = createController()
    latestEvents = undefined

    useWaveformControllerMock.mockImplementation(
      ({ events }: { events?: WaveformControllerEvents }) => {
        latestEvents = events
        return controller
      }
    )
  })

  afterEach(() => {
    useWaveformControllerMock.mockReset()
  })

  it("updates while recording when progress events arrive", async () => {
    controllerState = "recording"
    render(<AudioInput {...createProps()} />)

    const timer = screen.getByTestId("stAudioInputWaveformTimeCode")
    expect(timer).toHaveTextContent("00:00")

    act(() => {
      latestEvents?.onRecordStart?.()
    })

    act(() => {
      latestEvents?.onProgressMs?.(1200)
    })

    await waitFor(() => expect(timer).toHaveTextContent("00:01"))

    act(() => {
      latestEvents?.onProgressMs?.(3456)
    })

    await waitFor(() => expect(timer).toHaveTextContent("00:03"))
  })
})
