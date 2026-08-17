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

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest"

import ScreenCastRecorder from "./ScreenCastRecorder"

interface MockMediaRecorder {
  state: string
  start: Mock<() => void>
  stop: Mock<() => void>
  ondataavailable?: (event: { data: Blob }) => void
  onstop?: () => void
  onerror?: (event: Event) => void
}

let mockMediaRecorderInstance: MockMediaRecorder | undefined
let mediaRecorderIsTypeSupported: Mock<(type: string) => boolean>
let getDisplayMediaMock: Mock<(constraints?: unknown) => Promise<MediaStream>>
let getUserMediaMock: Mock<(constraints?: unknown) => Promise<MediaStream>>
let originalMediaDevicesDescriptor: PropertyDescriptor | undefined

/**
 * Build a minimal `MediaStream` stub. `getTracks` returns the provided
 * tracks and `getAudioTracks` returns the audio subset. We avoid relying on
 * the real `MediaStream` constructor which jsdom does not implement.
 */
const createMockStream = (
  tracks: { kind: string; stop: () => void }[] = []
): MediaStream =>
  ({
    getTracks: vi.fn(() => tracks),
    getAudioTracks: vi.fn(() => tracks.filter(t => t.kind === "audio")),
  }) as unknown as MediaStream

/**
 * Returns the most recently constructed mock `MediaRecorder`, throwing if
 * `initialize()` has not yet created one. Lets tests assign to mutable
 * fields (e.g. `state`, `start`) without repeating type-narrowing checks.
 */
const getMediaRecorder = (): MockMediaRecorder => {
  /* istanbul ignore next -- Defensive guard, only reached if a test forgets to call initialize(). */
  if (!mockMediaRecorderInstance) {
    throw new Error("MediaRecorder mock was not created")
  }
  return mockMediaRecorderInstance
}

const installMediaMocks = (): void => {
  mockMediaRecorderInstance = undefined
  getDisplayMediaMock = vi.fn()
  getUserMediaMock = vi.fn()
  mediaRecorderIsTypeSupported = vi.fn().mockReturnValue(true)

  originalMediaDevicesDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "mediaDevices"
  )
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getDisplayMedia: getDisplayMediaMock,
      getUserMedia: getUserMediaMock,
    },
  })

  class MediaRecorderMock implements MockMediaRecorder {
    public state = "inactive"
    public start = vi.fn<() => void>()
    public stop = vi.fn<() => void>()
    public ondataavailable?: (event: { data: Blob }) => void
    public onstop?: () => void
    public onerror?: (event: Event) => void

    constructor() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias -- Capturing the constructed instance is the whole point of the mock.
      mockMediaRecorderInstance = this
    }

    public static isTypeSupported = mediaRecorderIsTypeSupported
  }

  vi.stubGlobal("MediaRecorder", MediaRecorderMock)
  // jsdom does not implement MediaStream. Provide a minimal stub that
  // behaves like an array-of-tracks wrapper so initialize() can construct
  // a recorder input.
  vi.stubGlobal(
    "MediaStream",
    class {
      private readonly tracks: MediaStreamTrack[]
      constructor(tracks: MediaStreamTrack[] = []) {
        this.tracks = tracks
      }
      public getTracks = (): MediaStreamTrack[] => this.tracks
    }
  )
}

const restoreMediaDevices = (): void => {
  if (originalMediaDevicesDescriptor) {
    Object.defineProperty(
      navigator,
      "mediaDevices",
      originalMediaDevicesDescriptor
    )
  } else {
    Reflect.deleteProperty(navigator, "mediaDevices")
  }
  originalMediaDevicesDescriptor = undefined
}

describe("ScreenCastRecorder.isSupportedBrowser", () => {
  beforeEach(() => {
    installMediaMocks()
  })

  afterEach(() => {
    restoreMediaDevices()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("returns true when all required APIs are available", () => {
    expect(ScreenCastRecorder.isSupportedBrowser()).toBe(true)
  })

  it("returns false when MediaRecorder does not support the mime type", () => {
    mediaRecorderIsTypeSupported.mockReturnValue(false)
    expect(ScreenCastRecorder.isSupportedBrowser()).toBe(false)
  })

  it("returns false when navigator.mediaDevices is missing", () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    })
    expect(ScreenCastRecorder.isSupportedBrowser()).toBe(false)
  })

  it("returns false when MediaRecorder.isTypeSupported throws", () => {
    mediaRecorderIsTypeSupported.mockImplementation(() => {
      throw new Error("not supported")
    })
    expect(ScreenCastRecorder.isSupportedBrowser()).toBe(false)
  })
})

describe("ScreenCastRecorder lifecycle", () => {
  let onErrorOrStop: Mock<() => void>

  const createRecorder = (recordAudio = false): ScreenCastRecorder =>
    new ScreenCastRecorder({ recordAudio, onErrorOrStop })

  beforeEach(() => {
    installMediaMocks()
    onErrorOrStop = vi.fn()
  })

  afterEach(() => {
    restoreMediaDevices()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("getState returns 'inactive' before initialize() is called", () => {
    expect(createRecorder().getState()).toBe("inactive")
  })

  it("start() returns false when initialize() has not been called", () => {
    expect(createRecorder().start()).toBe(false)
    expect(onErrorOrStop).not.toHaveBeenCalled()
  })

  it("stop() returns undefined when initialize() has not been called", () => {
    expect(createRecorder().stop()).toBeUndefined()
    expect(onErrorOrStop).not.toHaveBeenCalled()
  })

  it("initialize() requests display media without audio when recordAudio=false", async () => {
    const videoTrack = { kind: "video", stop: vi.fn() }
    getDisplayMediaMock.mockResolvedValue(createMockStream([videoTrack]))

    await createRecorder(false).initialize()

    expect(getDisplayMediaMock).toHaveBeenCalledWith({ video: true })
    expect(getUserMediaMock).not.toHaveBeenCalled()
    expect(mockMediaRecorderInstance).toBeDefined()
    // initialize() must not stop tracks; that's reserved for stop().
    expect(videoTrack.stop).not.toHaveBeenCalled()
  })

  it("initialize() also requests audio when recordAudio=true", async () => {
    const videoTrack = { kind: "video", stop: vi.fn() }
    const audioTrack = { kind: "audio", stop: vi.fn() }
    getDisplayMediaMock.mockResolvedValue(createMockStream([videoTrack]))
    getUserMediaMock.mockResolvedValue(createMockStream([audioTrack]))

    await createRecorder(true).initialize()

    expect(getDisplayMediaMock).toHaveBeenCalledWith({ video: true })
    expect(getUserMediaMock).toHaveBeenCalledWith({
      video: false,
      audio: true,
    })
    expect(mockMediaRecorderInstance).toBeDefined()
    expect(videoTrack.stop).not.toHaveBeenCalled()
    expect(audioTrack.stop).not.toHaveBeenCalled()
  })

  it("getState reflects the underlying MediaRecorder state after initialize()", async () => {
    getDisplayMediaMock.mockResolvedValue(createMockStream())

    const recorder = createRecorder()
    await recorder.initialize()

    getMediaRecorder().state = "recording"
    expect(recorder.getState()).toBe("recording")
  })

  it("start() returns true and starts the underlying MediaRecorder", async () => {
    getDisplayMediaMock.mockResolvedValue(createMockStream())

    const recorder = createRecorder()
    await recorder.initialize()

    expect(recorder.start()).toBe(true)
    expect(getMediaRecorder().start).toHaveBeenCalledTimes(1)
  })

  it("start() invokes onErrorOrStop when the recorder dispatches an error", async () => {
    getDisplayMediaMock.mockResolvedValue(createMockStream())

    const recorder = createRecorder()
    await recorder.initialize()
    recorder.start()

    getMediaRecorder().onerror?.(new Event("error"))
    expect(onErrorOrStop).toHaveBeenCalledTimes(1)
  })

  it("start() returns false when MediaRecorder.start throws", async () => {
    getDisplayMediaMock.mockResolvedValue(createMockStream())

    const recorder = createRecorder()
    await recorder.initialize()

    getMediaRecorder().start = vi.fn(() => {
      throw new Error("start failed")
    })

    expect(recorder.start()).toBe(false)
    expect(onErrorOrStop).not.toHaveBeenCalled()
  })

  it("stop() resolves with a Blob built from collected chunks", async () => {
    const videoTrack = { kind: "video", stop: vi.fn() }
    getDisplayMediaMock.mockResolvedValue(createMockStream([videoTrack]))

    const recorder = createRecorder()
    await recorder.initialize()

    const dataChunk = new Blob(["chunk-data"], { type: "video/webm" })
    getMediaRecorder().ondataavailable?.({ data: dataChunk })

    const promise = recorder.stop()
    expect(getMediaRecorder().stop).toHaveBeenCalledTimes(1)
    expect(videoTrack.stop).toHaveBeenCalledTimes(1)

    getMediaRecorder().onstop?.()
    const blob = await promise
    expect(blob).toBeInstanceOf(Blob)
    expect(blob?.type).toBe("video/webm")
    expect(blob?.size).toBe(dataChunk.size)
  })

  it("stop() does not invoke onErrorOrStop when triggered by the user", async () => {
    getDisplayMediaMock.mockResolvedValue(createMockStream())

    const recorder = createRecorder()
    await recorder.initialize()
    recorder.start()

    const promise = recorder.stop()
    getMediaRecorder().onstop?.()
    await promise

    // The onstop handler set by start() is replaced by stop(); the
    // user-initiated stop should not bubble through onErrorOrStop.
    expect(onErrorOrStop).not.toHaveBeenCalled()
  })
})
