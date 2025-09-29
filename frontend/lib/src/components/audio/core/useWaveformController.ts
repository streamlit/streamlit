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

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import type WaveSurfer from "wavesurfer.js"

import { WaveSurferPlayer } from "~lib/components/audio/backends/WaveSurferPlayer"
import { WaveSurferRecordBackend } from "~lib/components/audio/backends/WaveSurferRecordBackend"
import { encodeToWav } from "~lib/components/audio/core/encodeToWav"
import type {
  RecordingState,
  WaveformController,
  WaveformControllerEvents,
} from "~lib/components/audio/core/types"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { convertRemToPx } from "~lib/theme/utils"

const BAR_WIDTH = 3
const BAR_GAP = 1
const BAR_RADIUS = 2
const CURSOR_WIDTH = 0
const WAVEFORM_PADDING = 8
const SAMPLE_RATE = 16000

interface UseWaveformControllerParams {
  containerRef: RefObject<HTMLElement>
  events?: WaveformControllerEvents
}

export function useWaveformController({
  containerRef,
  events,
}: UseWaveformControllerParams): WaveformController {
  const theme = useEmotionTheme()

  const [currentState, setCurrentState] = useState<RecordingState>("idle")
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null)

  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const recordBackendRef = useRef<WaveSurferRecordBackend | null>(null)
  const playerRef = useRef<WaveSurferPlayer | null>(null)
  const eventsRef = useRef<WaveformControllerEvents>(events || {})
  const isInitializedRef = useRef(false)

  useEffect(() => {
    eventsRef.current = events || {}
  }, [events])

  const initializeWaveSurfer = useCallback(async (): Promise<void> => {
    if (isInitializedRef.current || !containerRef.current) {
      return
    }

    try {
      const [WaveSurferModule, RecordPluginModule] = await Promise.all([
        import("wavesurfer.js"),
        import("wavesurfer.js/dist/plugins/record"),
      ])
      const WaveSurfer = WaveSurferModule.default
      const RecordPluginClass = RecordPluginModule.default

      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: theme.colors.primary,
        progressColor: theme.colors.bodyText,
        height:
          convertRemToPx(theme.sizes.largestElementHeight) -
          2 * WAVEFORM_PADDING,
        barWidth: BAR_WIDTH,
        barGap: BAR_GAP,
        barRadius: BAR_RADIUS,
        cursorWidth: CURSOR_WIDTH,
        interact: true,
      })

      wavesurferRef.current = ws

      const recordBackend = new WaveSurferRecordBackend({
        sampleRate: SAMPLE_RATE,
      })
      recordBackend.initialize(ws, RecordPluginClass)
      recordBackend.setEventHandlers({
        onRecordProgress: (ms: number) => {
          eventsRef.current.onProgressMs?.(ms)
        },
        onPermissionDenied: () => {
          eventsRef.current.onPermissionDenied?.()
          setCurrentState("idle")
        },
        onError: (error: Error) => {
          eventsRef.current.onError?.(error)
          setCurrentState("idle")
        },
      })
      recordBackendRef.current = recordBackend

      const player = new WaveSurferPlayer()
      player.initialize(ws)
      playerRef.current = player

      isInitializedRef.current = true
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      eventsRef.current.onError?.(err)
      throw err
    }
  }, [containerRef, theme])

  useEffect(() => {
    initializeWaveSurfer().catch(() => {})
    return (): void => {
      if (recordBackendRef.current) {
        recordBackendRef.current.destroy()
        recordBackendRef.current = null
      }
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy()
        wavesurferRef.current = null
      }
      isInitializedRef.current = false
    }
  }, [initializeWaveSurfer])

  const start = useCallback(async (): Promise<void> => {
    if (currentState === "recording") {
      return
    }

    if (!isInitializedRef.current) {
      await initializeWaveSurfer()
    }

    if (!recordBackendRef.current) {
      throw new Error("Record backend not initialized")
    }

    await recordBackendRef.current.startRecording()
    setCurrentState("recording")
    setCurrentBlob(null)
    eventsRef.current.onRecordStart?.()
  }, [currentState, initializeWaveSurfer])

  const resetPlayer = useCallback((): void => {
    if (playerRef.current && wavesurferRef.current) {
      playerRef.current.destroy()
      playerRef.current = new WaveSurferPlayer()
      playerRef.current.initialize(wavesurferRef.current)
    }
  }, [])

  const stop = useCallback(async (): Promise<void> => {
    if (currentState !== "recording") {
      throw new Error("Not currently recording")
    }

    if (!recordBackendRef.current || !playerRef.current) {
      throw new Error("Backends not initialized")
    }

    try {
      const rawBlob = await recordBackendRef.current.stopRecording()
      setCurrentBlob(rawBlob)
      setCurrentState("idle") // Recording stopped, back to idle state

      await new Promise<void>((resolve, reject) => {
        if (!playerRef.current) {
          reject(new Error("Player not initialized"))
          return
        }

        playerRef.current.setEventHandlers({
          onReady: () => {
            resolve()
          },
          onError: (error: Error) => {
            reject(error)
          },
        })

        playerRef.current.load(rawBlob).catch(reject)
      })

      eventsRef.current.onRecordReady?.(rawBlob)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      eventsRef.current.onError?.(err)
      throw err
    }
  }, [currentState])

  const approve = useCallback(async (): Promise<void> => {
    if (!currentBlob) {
      throw new Error("No recorded audio to approve")
    }

    try {
      const wav = await encodeToWav(currentBlob, SAMPLE_RATE)
      eventsRef.current.onApprove?.(wav)

      resetPlayer()
      setCurrentBlob(null)
      setCurrentState("idle")
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      eventsRef.current.onError?.(err)
      throw err
    }
  }, [currentBlob, resetPlayer])

  const cancel = useCallback((): void => {
    if (currentState === "recording") {
      recordBackendRef.current?.cancelRecording()
    }

    resetPlayer()
    setCurrentBlob(null)
    setCurrentState("idle")
    eventsRef.current.onCancel?.()
  }, [currentState, resetPlayer])

  const playback = {
    isPlaying: useCallback((): boolean => {
      return playerRef.current?.getIsPlaying() ?? false
    }, []),

    play: useCallback(async (): Promise<void> => {
      if (!playerRef.current) {
        throw new Error("Player not initialized")
      }
      await playerRef.current.play()
    }, []),

    pause: useCallback((): void => {
      playerRef.current?.pause()
    }, []),

    getCurrentTimeMs: useCallback((): number => {
      return playerRef.current?.getCurrentTime() ?? 0
    }, []),

    getDurationMs: useCallback((): number => {
      return playerRef.current?.getDuration() ?? 0
    }, []),
  }

  const setEventHandlers = useCallback(
    (newEvents: WaveformControllerEvents): void => {
      eventsRef.current = newEvents
    },
    []
  )

  return {
    state: currentState,
    start,
    stop,
    approve,
    cancel,
    playback,
    setEventHandlers,
  }
}
