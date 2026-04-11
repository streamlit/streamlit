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

import { act, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { AudioInput as AudioInputProto } from "@streamlit/protobuf"

import type {
  RecordingState,
  WaveformController,
  WaveformControllerEvents,
} from "~lib/components/audio/core/types"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { FormClearHelper } from "src/components/widgets/Form/FormClearHelper"

import AudioInput, { Props } from "./AudioInput"

const useWaveformControllerMock = vi.fn()
const uploadFilesMock = vi.fn()
const FormClearHelperMock = vi.fn()

vi.mock("~lib/components/audio/core/useWaveformController", () => ({
  useWaveformController: (...args: unknown[]) =>
    useWaveformControllerMock(...args),
}))

vi.mock("~lib/util/uploadFiles", () => ({
  uploadFiles: (...args: unknown[]) => uploadFilesMock(...args),
}))

vi.mock("~lib/components/widgets/Form/FormClearHelper", () => ({
  FormClearHelper: vi.fn().mockImplementation(function (
    this: FormClearHelper,
    ...args: unknown[]
  ) {
    return FormClearHelperMock(...args)
  }),
  useFormClearHelper: vi.fn(),
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

describe("AudioInput Recording Journey", () => {
  let controllerState: RecordingState
  let isPlaybackPlaying: boolean
  let controller: WaveformController
  let latestEvents: WaveformControllerEvents | undefined
  let mockUploadClient: ReturnType<typeof createUploadClient>
  let mockWidgetMgr: WidgetStateManager

  const createController = (): WaveformController => ({
    get state() {
      return controllerState
    },
    get isPlaybackPlaying() {
      return isPlaybackPlaying
    },
    mountRef: { current: document.createElement("div") },
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue({
      blob: new Blob(),
      meta: {
        durationMs: 0,
        sampleRate: 16000,
        mimeType: "audio/webm",
        size: 0,
      },
    }),
    approve: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockReturnValue(undefined),
    destroy: vi.fn().mockReturnValue(undefined),
    playback: {
      isPlaying: vi.fn().mockImplementation(() => isPlaybackPlaying),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockReturnValue(undefined),
      load: vi.fn().mockResolvedValue(undefined),
      getCurrentTimeMs: vi.fn().mockReturnValue(0),
      getDurationMs: vi.fn().mockReturnValue(0),
    },
    setEventHandlers: vi.fn().mockReturnValue(undefined),
  })

  beforeEach(() => {
    controllerState = "idle"
    isPlaybackPlaying = false
    controller = createController()
    latestEvents = undefined
    mockUploadClient = createUploadClient()
    mockWidgetMgr = createWidgetMgr()

    // Mock URL APIs
    global.URL.createObjectURL = vi.fn(() => "blob:test-url")
    global.URL.revokeObjectURL = vi.fn()

    // Mock uploadFiles to return success by default
    uploadFilesMock.mockResolvedValue({
      successfulUploads: [
        {
          fileUrl: {
            deleteUrl: "delete-url-123",
          },
        },
      ],
      failedUploads: [],
    })

    // Mock FormClearHelper - make it return the methods by default
    FormClearHelperMock.mockReturnValue({
      manageFormClearListener: vi.fn(),
      disconnect: vi.fn(),
    })

    useWaveformControllerMock.mockImplementation(
      ({ events }: { events?: WaveformControllerEvents }) => {
        latestEvents = events
        return controller
      }
    )
  })

  afterEach(() => {
    useWaveformControllerMock.mockReset()
    uploadFilesMock.mockReset()
    FormClearHelperMock.mockReset()
    vi.restoreAllMocks()
  })

  it("completes full recording to upload flow", async () => {
    const user = userEvent.setup()

    const props = createProps(
      {},
      { uploadClient: mockUploadClient, widgetMgr: mockWidgetMgr }
    )
    render(<AudioInput {...props} />)

    // Start recording
    const recordButton = screen.getByRole("button", { name: /record/i })
    await user.click(recordButton)
    expect(controller.start).toHaveBeenCalled()

    // Simulate recording progress
    act(() => {
      controllerState = "recording"
      void latestEvents?.onRecordStart?.()
    })

    act(() => {
      void latestEvents?.onProgressMs?.(1500)
    })

    // Verify stop button appears
    const stopButton = await screen.findByRole("button", {
      name: /stop recording/i,
    })
    expect(stopButton).toBeInTheDocument()

    // Simulate recording ready and approval
    const testBlob = new Blob(["test audio"], { type: "audio/wav" })
    act(() => {
      controllerState = "idle"
      void latestEvents?.onRecordReady?.(testBlob)
    })

    act(() => {
      void latestEvents?.onApprove?.(testBlob)
    })

    // Verify upload was triggered
    await waitFor(() => {
      expect(uploadFilesMock).toHaveBeenCalled()
    })

    // Verify blob URL created
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(testBlob)
  })

  it("handles recording cancellation", async () => {
    render(<AudioInput {...createProps()} />)

    act(() => {
      controllerState = "recording"
      void latestEvents?.onRecordStart?.()
    })

    act(() => {
      void latestEvents?.onProgressMs?.(2000)
    })

    const timer = screen.getByTestId("stAudioInputWaveformTimeCode")
    await waitFor(() => expect(timer).toHaveTextContent("00:02"))

    // Cancel recording
    act(() => {
      controllerState = "idle"
      void latestEvents?.onCancel?.()
    })

    // Verify state reset
    await waitFor(() => expect(timer).toHaveTextContent("00:00"))

    // Verify no upload triggered
    expect(uploadFilesMock).not.toHaveBeenCalled()
  })

  it("replaces existing recording when starting new one", async () => {
    render(
      <AudioInput
        {...createProps(
          {},
          { uploadClient: mockUploadClient, widgetMgr: mockWidgetMgr }
        )}
      />
    )

    // Simulate existing recording
    const oldBlob = new Blob(["old"])
    act(() => {
      void latestEvents?.onRecordReady?.(oldBlob)
      void latestEvents?.onApprove?.(oldBlob)
    })

    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })

    const firstBlobUrl = (
      global.URL.createObjectURL as ReturnType<typeof vi.fn>
    ).mock.results[0]?.value

    // Simulate starting new recording (component calls controller.start internally)
    // which triggers handleClear
    const user = userEvent.setup()
    const recordButtons = screen.queryAllByRole("button", {
      name: /record/i,
    })
    if (recordButtons.length > 0) {
      await user.click(recordButtons[0])
    }

    // Approve new recording
    const newBlob = new Blob(["new"])
    act(() => {
      void latestEvents?.onApprove?.(newBlob)
    })

    // Verify old blob URL was revoked when new one created
    await waitFor(() => {
      const revokeObjectURLCalls = (
        global.URL.revokeObjectURL as ReturnType<typeof vi.fn>
      ).mock.calls
      expect(revokeObjectURLCalls.some(call => call[0] === firstBlobUrl)).toBe(
        true
      )
    })
  })

  it("updates timer during recording progress", async () => {
    render(<AudioInput {...createProps()} />)

    const timer = screen.getByTestId("stAudioInputWaveformTimeCode")
    expect(timer).toHaveTextContent("00:00")

    act(() => {
      controllerState = "recording"
      void latestEvents?.onRecordStart?.()
    })

    act(() => {
      void latestEvents?.onProgressMs?.(1234)
    })

    await waitFor(() => expect(timer).toHaveTextContent("00:01"))

    act(() => {
      void latestEvents?.onProgressMs?.(5678)
    })

    await waitFor(() => expect(timer).toHaveTextContent("00:05"))

    // Recording completes
    act(() => {
      controllerState = "idle"
      controller.playback.getDurationMs = vi.fn().mockReturnValue(5678)
      void latestEvents?.onRecordReady?.(new Blob())
    })

    await waitFor(() => expect(timer).toHaveTextContent("00:05"))
  })
})

describe("AudioInput Playback Journey", () => {
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
    mountRef: { current: document.createElement("div") },
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue({
      blob: new Blob(),
      meta: {
        durationMs: 0,
        sampleRate: 16000,
        mimeType: "audio/webm",
        size: 0,
      },
    }),
    approve: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockReturnValue(undefined),
    destroy: vi.fn().mockReturnValue(undefined),
    playback: {
      isPlaying: vi.fn().mockImplementation(() => isPlaybackPlaying),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockReturnValue(undefined),
      load: vi.fn().mockResolvedValue(undefined),
      getCurrentTimeMs: vi.fn().mockReturnValue(0),
      getDurationMs: vi.fn().mockReturnValue(0),
    },
    setEventHandlers: vi.fn().mockReturnValue(undefined),
  })

  beforeEach(() => {
    controllerState = "idle"
    isPlaybackPlaying = false
    controller = createController()
    latestEvents = undefined

    global.requestAnimationFrame = vi.fn(() => 123)
    global.cancelAnimationFrame = vi.fn()

    // Mock FormClearHelper
    FormClearHelperMock.mockReturnValue({
      manageFormClearListener: vi.fn(),
      disconnect: vi.fn(),
    })

    useWaveformControllerMock.mockImplementation(
      ({ events }: { events?: WaveformControllerEvents }) => {
        latestEvents = events
        return controller
      }
    )
  })

  afterEach(() => {
    useWaveformControllerMock.mockReset()
    FormClearHelperMock.mockReset()
    vi.restoreAllMocks()
  })

  it("handles play, pause, and resume flow", async () => {
    const user = userEvent.setup()

    // Need uploadFiles to succeed for recording to exist
    uploadFilesMock.mockResolvedValue({
      successfulUploads: [{ fileUrl: { deleteUrl: "delete-123" } }],
      failedUploads: [],
    })

    render(<AudioInput {...createProps()} />)

    // Simulate recording exists
    const testBlob = new Blob(["test"], { type: "audio/wav" })
    ;(
      controller.playback.getDurationMs as ReturnType<typeof vi.fn>
    ).mockReturnValue(5000)

    act(() => {
      void latestEvents?.onRecordReady?.(testBlob)
    })

    act(() => {
      void latestEvents?.onApprove?.(testBlob)
    })

    // Wait for upload to complete
    await waitFor(() => {
      expect(uploadFilesMock).toHaveBeenCalled()
    })

    // Wait for play button to appear
    const playButton = await screen.findByRole("button", { name: /play/i })
    await user.click(playButton)

    expect(controller.playback.play).toHaveBeenCalled()

    // Simulate playback pause via event
    ;(
      controller.playback.getCurrentTimeMs as ReturnType<typeof vi.fn>
    ).mockReturnValue(1500)
    act(() => {
      isPlaybackPlaying = false
      void latestEvents?.onPlaybackPause?.()
    })

    const timer = screen.getByTestId("stAudioInputWaveformTimeCode")
    await waitFor(() => expect(timer).toHaveTextContent("00:01"))
  })

  it("updates timer to duration when playback finishes", async () => {
    controller.playback.getDurationMs = vi.fn().mockReturnValue(8500)

    render(<AudioInput {...createProps()} />)

    act(() => {
      void latestEvents?.onPlaybackFinish?.()
    })

    const timer = screen.getByTestId("stAudioInputWaveformTimeCode")
    await waitFor(() => expect(timer).toHaveTextContent("00:08"))
  })

  it("snaps playback time to 00:00 at start", async () => {
    const user = userEvent.setup()

    // Need uploadFiles to succeed
    uploadFilesMock.mockResolvedValue({
      successfulUploads: [{ fileUrl: { deleteUrl: "delete-123" } }],
      failedUploads: [],
    })

    // getCurrentTimeMs returns small offset (<100ms)
    ;(
      controller.playback.getCurrentTimeMs as ReturnType<typeof vi.fn>
    ).mockReturnValue(50)
    ;(
      controller.playback.getDurationMs as ReturnType<typeof vi.fn>
    ).mockReturnValue(5000)

    render(<AudioInput {...createProps()} />)

    // Setup recording
    const testBlob = new Blob(["test"], { type: "audio/wav" })
    act(() => {
      void latestEvents?.onRecordReady?.(testBlob)
      void latestEvents?.onApprove?.(testBlob)
    })

    // Wait for upload
    await waitFor(() => {
      expect(uploadFilesMock).toHaveBeenCalled()
    })

    // Wait for play button
    const playButton = await screen.findByRole("button", { name: /play/i })
    await user.click(playButton)

    // Timer should snap to 00:00, not show 00:00 (which would be wrong)
    const timer = screen.getByTestId("stAudioInputWaveformTimeCode")
    expect(timer).toHaveTextContent("00:00")
  })
})

describe("AudioInput Upload & Abort", () => {
  let controllerState: RecordingState
  let isPlaybackPlaying: boolean
  let controller: WaveformController
  let latestEvents: WaveformControllerEvents | undefined
  let mockUploadClient: ReturnType<typeof createUploadClient>
  let mockWidgetMgr: WidgetStateManager
  let capturedAbortSignal: AbortSignal | undefined

  const createController = (): WaveformController => ({
    get state() {
      return controllerState
    },
    get isPlaybackPlaying() {
      return isPlaybackPlaying
    },
    mountRef: { current: document.createElement("div") },
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue({
      blob: new Blob(),
      meta: {
        durationMs: 0,
        sampleRate: 16000,
        mimeType: "audio/webm",
        size: 0,
      },
    }),
    approve: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockReturnValue(undefined),
    destroy: vi.fn().mockReturnValue(undefined),
    playback: {
      isPlaying: vi.fn().mockImplementation(() => isPlaybackPlaying),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockReturnValue(undefined),
      load: vi.fn().mockResolvedValue(undefined),
      getCurrentTimeMs: vi.fn().mockReturnValue(0),
      getDurationMs: vi.fn().mockReturnValue(0),
    },
    setEventHandlers: vi.fn().mockReturnValue(undefined),
  })

  beforeEach(() => {
    controllerState = "idle"
    isPlaybackPlaying = false
    controller = createController()
    latestEvents = undefined
    mockUploadClient = createUploadClient()
    mockWidgetMgr = createWidgetMgr()
    capturedAbortSignal = undefined

    global.URL.createObjectURL = vi.fn(() => "blob:test-url")
    global.URL.revokeObjectURL = vi.fn()

    // Mock uploadFiles to capture abort signal
    uploadFilesMock.mockImplementation(({ signal }) => {
      capturedAbortSignal = signal
      return new Promise(() => {
        // Never resolves - simulates hanging upload
      })
    })

    // Mock FormClearHelper
    FormClearHelperMock.mockReturnValue({
      manageFormClearListener: vi.fn(),
      disconnect: vi.fn(),
    })

    useWaveformControllerMock.mockImplementation(
      ({ events }: { events?: WaveformControllerEvents }) => {
        latestEvents = events
        return controller
      }
    )
  })

  afterEach(() => {
    useWaveformControllerMock.mockReset()
    uploadFilesMock.mockReset()
    vi.restoreAllMocks()
  })

  it("aborts upload on unmount", async () => {
    const props = createProps(
      {},
      { uploadClient: mockUploadClient, widgetMgr: mockWidgetMgr }
    )
    const { unmount } = render(<AudioInput {...props} />)

    // Trigger upload
    const testBlob = new Blob(["test"], { type: "audio/wav" })
    act(() => {
      void latestEvents?.onApprove?.(testBlob)
    })

    // Wait for upload to start
    await waitFor(() => {
      expect(uploadFilesMock).toHaveBeenCalled()
    })

    // Verify signal is not aborted yet
    expect(capturedAbortSignal?.aborted).toBe(false)

    // Unmount component
    unmount()

    // Verify abort was called
    await waitFor(() => {
      expect(capturedAbortSignal?.aborted).toBe(true)
    })
  })

  it("aborts previous upload when starting new upload", async () => {
    const props = createProps(
      {},
      { uploadClient: mockUploadClient, widgetMgr: mockWidgetMgr }
    )
    render(<AudioInput {...props} />)

    // Start first upload
    const testBlob1 = new Blob(["first"], { type: "audio/wav" })
    act(() => {
      void latestEvents?.onApprove?.(testBlob1)
    })

    await waitFor(() => {
      expect(uploadFilesMock).toHaveBeenCalled()
    })

    const firstSignal = capturedAbortSignal
    expect(firstSignal?.aborted).toBe(false)

    // Trigger second upload (which should abort first)
    const testBlob2 = new Blob(["second"], { type: "audio/wav" })
    act(() => {
      void latestEvents?.onApprove?.(testBlob2)
    })

    // First upload should have been aborted
    expect(firstSignal?.aborted).toBe(true)
  })

  it("shows error when upload fails", async () => {
    uploadFilesMock.mockRejectedValue(new Error("Upload failed"))

    const props = createProps(
      {},
      { uploadClient: mockUploadClient, widgetMgr: mockWidgetMgr }
    )
    render(<AudioInput {...props} />)

    const testBlob = new Blob(["test"], { type: "audio/wav" })
    act(() => {
      void latestEvents?.onApprove?.(testBlob)
    })

    await waitFor(() => {
      expect(
        screen.getByText(/An error has occurred, please try again/i)
      ).toBeInTheDocument()
    })
  })

  it("handles upload with failed uploads array", async () => {
    uploadFilesMock.mockResolvedValue({
      successfulUploads: [],
      failedUploads: [{ error: "Upload error" }],
    })

    const props = createProps(
      {},
      { uploadClient: mockUploadClient, widgetMgr: mockWidgetMgr }
    )
    render(<AudioInput {...props} />)

    const testBlob = new Blob(["test"], { type: "audio/wav" })
    act(() => {
      void latestEvents?.onApprove?.(testBlob)
    })

    await waitFor(() => {
      expect(
        screen.getByText(/An error has occurred, please try again/i)
      ).toBeInTheDocument()
    })
  })
})

describe("AudioInput Memory Management", () => {
  let controllerState: RecordingState
  let isPlaybackPlaying: boolean
  let controller: WaveformController
  let latestEvents: WaveformControllerEvents | undefined
  let mockUploadClient: ReturnType<typeof createUploadClient>
  let blobUrlCounter = 0

  const createController = (): WaveformController => ({
    get state() {
      return controllerState
    },
    get isPlaybackPlaying() {
      return isPlaybackPlaying
    },
    mountRef: { current: document.createElement("div") },
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue({
      blob: new Blob(),
      meta: {
        durationMs: 0,
        sampleRate: 16000,
        mimeType: "audio/webm",
        size: 0,
      },
    }),
    approve: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockReturnValue(undefined),
    destroy: vi.fn().mockReturnValue(undefined),
    playback: {
      isPlaying: vi.fn().mockImplementation(() => isPlaybackPlaying),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockReturnValue(undefined),
      load: vi.fn().mockResolvedValue(undefined),
      getCurrentTimeMs: vi.fn().mockReturnValue(0),
      getDurationMs: vi.fn().mockReturnValue(0),
    },
    setEventHandlers: vi.fn().mockReturnValue(undefined),
  })

  beforeEach(() => {
    controllerState = "idle"
    isPlaybackPlaying = false
    controller = createController()
    latestEvents = undefined
    mockUploadClient = createUploadClient()
    blobUrlCounter = 0

    // Mock URL to return unique URLs
    global.URL.createObjectURL = vi.fn(
      () => `blob:test-url-${++blobUrlCounter}`
    )
    global.URL.revokeObjectURL = vi.fn()

    uploadFilesMock.mockResolvedValue({
      successfulUploads: [{ fileUrl: { deleteUrl: "delete-123" } }],
      failedUploads: [],
    })

    // Mock FormClearHelper
    FormClearHelperMock.mockReturnValue({
      manageFormClearListener: vi.fn(),
      disconnect: vi.fn(),
    })

    useWaveformControllerMock.mockImplementation(
      ({ events }: { events?: WaveformControllerEvents }) => {
        latestEvents = events
        return controller
      }
    )
  })

  afterEach(() => {
    useWaveformControllerMock.mockReset()
    uploadFilesMock.mockReset()
    FormClearHelperMock.mockReset()
    vi.restoreAllMocks()
  })

  it("revokes old blob URL when creating new recording", async () => {
    const props = createProps({}, { uploadClient: mockUploadClient })
    render(<AudioInput {...props} />)

    // Create first recording
    const blob1 = new Blob(["first"], { type: "audio/wav" })
    act(() => {
      void latestEvents?.onApprove?.(blob1)
    })

    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(blob1)
    })

    const firstBlobUrl = "blob:test-url-1"

    // Create second recording
    const blob2 = new Blob(["second"], { type: "audio/wav" })
    act(() => {
      void latestEvents?.onApprove?.(blob2)
    })

    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(blob2)
    })

    // Verify first blob URL was revoked
    await waitFor(() => {
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(firstBlobUrl)
    })
  })

  it("revokes blob URL and deletes file when delete button clicked", async () => {
    const user = userEvent.setup()

    const props = createProps({}, { uploadClient: mockUploadClient })
    render(<AudioInput {...props} />)

    // Create recording
    const blob = new Blob(["test"], { type: "audio/wav" })
    act(() => {
      void latestEvents?.onApprove?.(blob)
    })

    await waitFor(() => {
      expect(uploadFilesMock).toHaveBeenCalled()
    })

    const blobUrl = "blob:test-url-1"

    // Wait for toolbar to appear with delete button
    const deleteButton = await screen.findByRole("button", {
      name: /clear recording/i,
    })

    await user.click(deleteButton)

    // Verify blob URL revoked
    await waitFor(() => {
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(blobUrl)
    })

    // Verify file deleted from server
    expect(mockUploadClient.deleteFile).toHaveBeenCalledWith("delete-123")
  })

  it("cancels animation frame on unmount during playback", async () => {
    isPlaybackPlaying = true

    global.requestAnimationFrame = vi.fn(() => 456)
    global.cancelAnimationFrame = vi.fn()

    const { unmount } = render(<AudioInput {...createProps()} />)

    await waitFor(() => {
      expect(global.requestAnimationFrame).toHaveBeenCalled()
    })

    unmount()

    expect(global.cancelAnimationFrame).toHaveBeenCalled()
  })
})

describe("AudioInput Form Integration", () => {
  let controllerState: RecordingState
  let isPlaybackPlaying: boolean
  let controller: WaveformController
  let latestEvents: WaveformControllerEvents | undefined
  let formClearCallback: (() => void) | undefined

  const createController = (): WaveformController => ({
    get state() {
      return controllerState
    },
    get isPlaybackPlaying() {
      return isPlaybackPlaying
    },
    mountRef: { current: document.createElement("div") },
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue({
      blob: new Blob(),
      meta: {
        durationMs: 0,
        sampleRate: 16000,
        mimeType: "audio/webm",
        size: 0,
      },
    }),
    approve: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockReturnValue(undefined),
    destroy: vi.fn().mockReturnValue(undefined),
    playback: {
      isPlaying: vi.fn().mockImplementation(() => isPlaybackPlaying),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockReturnValue(undefined),
      load: vi.fn().mockResolvedValue(undefined),
      getCurrentTimeMs: vi.fn().mockReturnValue(0),
      getDurationMs: vi.fn().mockReturnValue(0),
    },
    setEventHandlers: vi.fn().mockReturnValue(undefined),
  })

  beforeEach(() => {
    controllerState = "idle"
    isPlaybackPlaying = false
    controller = createController()
    latestEvents = undefined
    formClearCallback = undefined

    global.URL.createObjectURL = vi.fn(() => "blob:form-test")
    global.URL.revokeObjectURL = vi.fn()

    uploadFilesMock.mockResolvedValue({
      successfulUploads: [{ fileUrl: { deleteUrl: "delete-form" } }],
      failedUploads: [],
    })

    // Mock FormClearHelper to capture callback
    FormClearHelperMock.mockImplementation(() => ({
      manageFormClearListener: vi.fn((_widgetMgr, _formId, callback) => {
        formClearCallback = callback
      }),
      disconnect: vi.fn(),
    }))

    useWaveformControllerMock.mockImplementation(
      ({ events }: { events?: WaveformControllerEvents }) => {
        latestEvents = events
        return controller
      }
    )
  })

  afterEach(() => {
    useWaveformControllerMock.mockReset()
    uploadFilesMock.mockReset()
    FormClearHelperMock.mockReset()
    vi.restoreAllMocks()
  })

  it("clears recording when form submits", async () => {
    const mockWidgetMgr = createWidgetMgr()
    vi.spyOn(mockWidgetMgr, "setFileUploaderStateValue")

    const props = createProps(
      { formId: "test-form" },
      { widgetMgr: mockWidgetMgr }
    )
    render(<AudioInput {...props} />)

    // Create recording
    const blob = new Blob(["test"], { type: "audio/wav" })
    act(() => {
      void latestEvents?.onApprove?.(blob)
    })

    await waitFor(() => {
      expect(uploadFilesMock).toHaveBeenCalled()
    })

    // Verify FormClearHelper was set up
    expect(FormClearHelperMock).toHaveBeenCalled()
    expect(formClearCallback).toBeDefined()

    // Trigger form submit
    act(() => {
      formClearCallback?.()
    })

    // Verify recording cleared
    await waitFor(() => {
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:form-test")
    })

    // Verify widget state updated
    expect(mockWidgetMgr.setFileUploaderStateValue).toHaveBeenCalled()

    // Verify controller cancelled
    expect(controller.cancel).toHaveBeenCalled()
  })
})

describe("AudioInput Error Handling", () => {
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
    mountRef: { current: document.createElement("div") },
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue({
      blob: new Blob(),
      meta: {
        durationMs: 0,
        sampleRate: 16000,
        mimeType: "audio/webm",
        size: 0,
      },
    }),
    approve: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockReturnValue(undefined),
    destroy: vi.fn().mockReturnValue(undefined),
    playback: {
      isPlaying: vi.fn().mockImplementation(() => isPlaybackPlaying),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockReturnValue(undefined),
      load: vi.fn().mockResolvedValue(undefined),
      getCurrentTimeMs: vi.fn().mockReturnValue(0),
      getDurationMs: vi.fn().mockReturnValue(0),
    },
    setEventHandlers: vi.fn().mockReturnValue(undefined),
  })

  beforeEach(() => {
    controllerState = "idle"
    isPlaybackPlaying = false
    controller = createController()
    latestEvents = undefined

    // Mock FormClearHelper
    FormClearHelperMock.mockReturnValue({
      manageFormClearListener: vi.fn(),
      disconnect: vi.fn(),
    })

    useWaveformControllerMock.mockImplementation(
      ({ events }: { events?: WaveformControllerEvents }) => {
        latestEvents = events
        return controller
      }
    )
  })

  afterEach(() => {
    useWaveformControllerMock.mockReset()
    FormClearHelperMock.mockReset()
  })

  it("shows permission denied state", async () => {
    render(<AudioInput {...createProps()} />)

    act(() => {
      void latestEvents?.onPermissionDenied?.()
    })

    await waitFor(() => {
      expect(
        screen.getByText(/This app would like to use your microphone/i)
      ).toBeInTheDocument()
    })

    // Verify buttons are disabled
    const recordButton = screen.getByRole("button", { name: /record/i })
    expect(recordButton).toBeDisabled()
  })

  it("shows and clears error state", async () => {
    const user = userEvent.setup()

    render(<AudioInput {...createProps()} />)

    act(() => {
      void latestEvents?.onError?.(new Error("Test error"))
    })

    await waitFor(() => {
      expect(
        screen.getByText(/An error has occurred, please try again/i)
      ).toBeInTheDocument()
    })

    // Click reset to clear error
    const resetButton = screen.getByRole("button", { name: /reset/i })
    await user.click(resetButton)

    await waitFor(() => {
      expect(
        screen.queryByText(/An error has occurred, please try again/i)
      ).not.toBeInTheDocument()
    })

    // Verify can record again
    const recordButton = screen.getByRole("button", { name: /record/i })
    expect(recordButton).not.toBeDisabled()
  })
})

describe("AudioInput Widget State", () => {
  let controllerState: RecordingState
  let isPlaybackPlaying: boolean
  let controller: WaveformController
  let latestEvents: WaveformControllerEvents | undefined
  let mockUploadClient: ReturnType<typeof createUploadClient>
  let mockWidgetMgr: WidgetStateManager

  const createController = (): WaveformController => ({
    get state() {
      return controllerState
    },
    get isPlaybackPlaying() {
      return isPlaybackPlaying
    },
    mountRef: { current: document.createElement("div") },
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue({
      blob: new Blob(),
      meta: {
        durationMs: 0,
        sampleRate: 16000,
        mimeType: "audio/webm",
        size: 0,
      },
    }),
    approve: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockReturnValue(undefined),
    destroy: vi.fn().mockReturnValue(undefined),
    playback: {
      isPlaying: vi.fn().mockImplementation(() => isPlaybackPlaying),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockReturnValue(undefined),
      load: vi.fn().mockResolvedValue(undefined),
      getCurrentTimeMs: vi.fn().mockReturnValue(0),
      getDurationMs: vi.fn().mockReturnValue(0),
    },
    setEventHandlers: vi.fn().mockReturnValue(undefined),
  })

  beforeEach(() => {
    controllerState = "idle"
    isPlaybackPlaying = false
    controller = createController()
    latestEvents = undefined
    mockUploadClient = createUploadClient()
    mockWidgetMgr = createWidgetMgr()

    global.URL.createObjectURL = vi.fn(() => "blob:widget-test")
    global.URL.revokeObjectURL = vi.fn()

    uploadFilesMock.mockResolvedValue({
      successfulUploads: [
        {
          fileUrl: {
            deleteUrl: "delete-widget-123",
          },
        },
      ],
      failedUploads: [],
    })

    // Mock FormClearHelper
    FormClearHelperMock.mockReturnValue({
      manageFormClearListener: vi.fn(),
      disconnect: vi.fn(),
    })

    useWaveformControllerMock.mockImplementation(
      ({ events }: { events?: WaveformControllerEvents }) => {
        latestEvents = events
        return controller
      }
    )
  })

  afterEach(() => {
    useWaveformControllerMock.mockReset()
    uploadFilesMock.mockReset()
    FormClearHelperMock.mockReset()
    vi.restoreAllMocks()
  })

  it("updates widget state with upload info", async () => {
    vi.spyOn(mockWidgetMgr, "setFileUploaderStateValue")

    const props = createProps(
      { id: "audio-1", formId: "form-1" },
      {
        uploadClient: mockUploadClient,
        widgetMgr: mockWidgetMgr,
        fragmentId: "fragment-1",
      }
    )
    render(<AudioInput {...props} />)

    const testBlob = new Blob(["test"], { type: "audio/wav" })
    act(() => {
      void latestEvents?.onApprove?.(testBlob)
    })

    await waitFor(() => {
      expect(uploadFilesMock).toHaveBeenCalled()
    })

    // Verify uploadFiles was called with correct params
    const uploadCall = uploadFilesMock.mock.calls[0][0]
    expect(uploadCall.widgetInfo.id).toBe("audio-1")
    expect(uploadCall.widgetInfo.formId).toBe("form-1")
    expect(uploadCall.fragmentId).toBe("fragment-1")
    expect(uploadCall.files).toHaveLength(1)
    expect(uploadCall.files[0].type).toBe("audio/wav")
  })
})
