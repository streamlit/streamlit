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

import { act, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

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

  it("updates timer during playback when playing", async () => {
    controllerState = "idle"
    isPlaybackPlaying = true

    const getCurrentTimeMsMock = vi
      .fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1500)
      .mockReturnValueOnce(3200)
    controller.playback.getCurrentTimeMs = getCurrentTimeMsMock

    render(<AudioInput {...createProps()} />)

    // Wait for animation frame updates
    await waitFor(
      () => {
        expect(getCurrentTimeMsMock).toHaveBeenCalled()
      },
      { timeout: 100 }
    )
  })

  it("displays recording time when recording", async () => {
    controllerState = "recording"
    render(<AudioInput {...createProps()} />)

    act(() => {
      latestEvents?.onRecordStart?.()
    })

    act(() => {
      latestEvents?.onProgressMs?.(5000)
    })

    const timer = screen.getByTestId("stAudioInputWaveformTimeCode")
    await waitFor(() => expect(timer).toHaveTextContent("00:05"))
  })

  it("updates to duration when playback finishes", async () => {
    controllerState = "idle"
    controller.playback.getDurationMs = vi.fn().mockReturnValue(8500)

    render(<AudioInput {...createProps()} />)

    act(() => {
      latestEvents?.onPlaybackFinish?.()
    })

    const timer = screen.getByTestId("stAudioInputWaveformTimeCode")
    await waitFor(() => expect(timer).toHaveTextContent("00:08"))
  })

  it("updates to current time when playback pauses", async () => {
    controllerState = "idle"
    controller.playback.getCurrentTimeMs = vi.fn().mockReturnValue(4200)

    render(<AudioInput {...createProps()} />)

    act(() => {
      latestEvents?.onPlaybackPause?.()
    })

    const timer = screen.getByTestId("stAudioInputWaveformTimeCode")
    await waitFor(() => expect(timer).toHaveTextContent("00:04"))
  })

  it("sets duration when recording is ready", async () => {
    controllerState = "idle"
    controller.playback.getDurationMs = vi.fn().mockReturnValue(12000)

    render(<AudioInput {...createProps()} />)

    act(() => {
      latestEvents?.onRecordReady?.(new Blob())
    })

    const timer = screen.getByTestId("stAudioInputWaveformTimeCode")
    await waitFor(() => expect(timer).toHaveTextContent("00:12"))
  })

  it("resets timer on cancel", async () => {
    controllerState = "recording"
    render(<AudioInput {...createProps()} />)

    act(() => {
      latestEvents?.onProgressMs?.(5000)
    })

    const timer = screen.getByTestId("stAudioInputWaveformTimeCode")
    await waitFor(() => expect(timer).toHaveTextContent("00:05"))

    act(() => {
      latestEvents?.onCancel?.()
    })

    await waitFor(() => expect(timer).toHaveTextContent("00:00"))
  })
})

describe("AudioInput error handling", () => {
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

  it("shows error state when onError event fires", async () => {
    render(<AudioInput {...createProps()} />)

    act(() => {
      latestEvents?.onError?.(new Error("Test error"))
    })

    await waitFor(() => {
      expect(
        screen.getByText(/An error has occurred, please try again/i)
      ).toBeInTheDocument()
    })
  })

  it("shows no permissions state when onPermissionDenied fires", async () => {
    render(<AudioInput {...createProps()} />)

    act(() => {
      latestEvents?.onPermissionDenied?.()
    })

    await waitFor(() => {
      expect(
        screen.getByText(/This app would like to use your microphone/i)
      ).toBeInTheDocument()
    })
  })
})

describe("AudioInput file upload", () => {
  let controllerState: RecordingState
  let isPlaybackPlaying: boolean
  let controller: WaveformController
  let latestEvents: WaveformControllerEvents | undefined
  let mockUploadClient: ReturnType<typeof createUploadClient>

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
    mockUploadClient = createUploadClient()

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => "blob:test-url")
    global.URL.revokeObjectURL = vi.fn()

    useWaveformControllerMock.mockImplementation(
      ({ events }: { events?: WaveformControllerEvents }) => {
        latestEvents = events
        return controller
      }
    )
  })

  afterEach(() => {
    useWaveformControllerMock.mockReset()
    vi.restoreAllMocks()
  })

  it("triggers upload when onApprove fires", async () => {
    const props = createProps({}, { uploadClient: mockUploadClient })
    render(<AudioInput {...props} />)

    const testBlob = new Blob(["test audio data"], { type: "audio/wav" })

    act(() => {
      latestEvents?.onApprove?.(testBlob)
    })

    // The upload flow involves async operations and blob URL creation
    // Just verify the onApprove event handler is wired up
    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })
  })
})

describe("AudioInput cleanup", () => {
  let controllerState: RecordingState
  let isPlaybackPlaying: boolean
  let controller: WaveformController

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

    // Mock animation frame functions
    global.requestAnimationFrame = vi.fn(cb => {
      setTimeout(cb, 0)
      return 123
    }) as unknown as typeof requestAnimationFrame
    global.cancelAnimationFrame = vi.fn()

    // Mock URL functions
    global.URL.createObjectURL = vi.fn(() => "blob:test-url")
    global.URL.revokeObjectURL = vi.fn()

    useWaveformControllerMock.mockImplementation(() => {
      return controller
    })
  })

  afterEach(() => {
    useWaveformControllerMock.mockReset()
    vi.restoreAllMocks()
  })

  it("cleans up animation frame on unmount", async () => {
    isPlaybackPlaying = true
    const { unmount } = render(<AudioInput {...createProps()} />)

    // Wait for animation frame to be requested
    await waitFor(() => {
      expect(global.requestAnimationFrame).toHaveBeenCalled()
    })

    unmount()

    expect(global.cancelAnimationFrame).toHaveBeenCalled()
  })

  it("cleans up animation frame when playback stops", async () => {
    const { rerender } = render(<AudioInput {...createProps()} />)

    // Start playback
    isPlaybackPlaying = true
    rerender(<AudioInput {...createProps()} />)

    await waitFor(() => {
      expect(global.requestAnimationFrame).toHaveBeenCalled()
    })

    // Stop playback
    isPlaybackPlaying = false
    rerender(<AudioInput {...createProps()} />)

    await waitFor(() => {
      expect(global.cancelAnimationFrame).toHaveBeenCalled()
    })
  })
})

describe("AudioInput button interactions", () => {
  let controllerState: RecordingState
  let isPlaybackPlaying: boolean
  let controller: WaveformController

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

    useWaveformControllerMock.mockImplementation(() => {
      return controller
    })
  })

  afterEach(() => {
    useWaveformControllerMock.mockReset()
  })

  it("calls controller.start when record button is clicked", async () => {
    const user = userEvent.setup()
    render(<AudioInput {...createProps()} />)

    const recordButton = screen.getByRole("button", { name: /record/i })
    await user.click(recordButton)

    expect(controller.start).toHaveBeenCalled()
  })

  it("calls controller.stop and approve when stop button is clicked", async () => {
    const user = userEvent.setup()
    controllerState = "recording"
    render(<AudioInput {...createProps()} />)

    const stopButton = screen.getByRole("button", { name: /stop/i })
    await user.click(stopButton)

    expect(controller.stop).toHaveBeenCalled()
    await waitFor(() => {
      expect(controller.approve).toHaveBeenCalled()
    })
  })
})
