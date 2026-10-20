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
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import type WaveSurfer from "wavesurfer.js"

import {
  type PlayerEvents,
  WaveSurferPlayer,
} from "~lib/components/audio/backends/WaveSurferPlayer"
import { WaveSurferRecordBackend } from "~lib/components/audio/backends/WaveSurferRecordBackend"
import { encodeToWav } from "~lib/components/audio/core/encodeToWav"
import { loadWaveSurferModules } from "~lib/components/audio/core/loadWaveSurferModules"
import { RecordingCancelledError } from "~lib/components/audio/core/RecordingCancelledError"
import type {
  AudioMeta,
  RecordingState,
  StopResult,
  WaveformController,
  WaveformControllerEvents,
} from "~lib/components/audio/core/types"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { blend, convertRemToPx } from "~lib/theme/utils"

const BAR_WIDTH = 4
const BAR_GAP = 4
const BAR_RADIUS = 8
const CURSOR_WIDTH = 0
const DEFAULT_SAMPLE_RATE = 16000

interface ReadyResolver {
  resolve: () => void
  reject: (error: Error) => void
}

interface WaveformStyles {
  activeColor: string
  progressColor: string
  playbackWaveColor: string
  height: number | "auto"
}

interface UseWaveformControllerParams {
  containerRef: RefObject<HTMLDivElement>
  sampleRate?: number | null
  events: WaveformControllerEvents
  /**
   * Vertical padding in pixels to apply around the waveform.
   * This reduces the waveform height to prevent it from touching container edges.
   */
  waveformPadding?: number
}

export function useWaveformController({
  containerRef,
  sampleRate,
  events,
  waveformPadding = 0,
}: UseWaveformControllerParams): WaveformController {
  const theme = useEmotionTheme()

  const [currentState, setCurrentState] = useState<RecordingState>("idle")
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null)
  const [isPlaybackPlaying, setIsPlaybackPlaying] = useState(false)

  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const recordBackendRef = useRef<WaveSurferRecordBackend | null>(null)
  const playerRef = useRef<WaveSurferPlayer | null>(null)
  const eventsRef = useRef<WaveformControllerEvents>(events)
  const isInitializedRef = useRef(false)
  const initPromiseRef = useRef<Promise<void> | null>(null)
  const initGenerationRef = useRef(0)
  const readyResolversRef = useRef<Set<ReadyResolver>>(new Set())
  const isPlaybackModeRef = useRef(false)

  // Use the provided sample rate if specified; if undefined, fall back to DEFAULT_SAMPLE_RATE; if null, use null.
  const effectiveSampleRate =
    sampleRate === undefined ? DEFAULT_SAMPLE_RATE : sampleRate

  // convertRemToPx can read computed styles, so only recompute when the
  // theme values or padding change.
  const waveformStyles = useMemo<WaveformStyles>(
    () => ({
      activeColor: theme.colors.primary,
      progressColor: theme.colors.bodyText,
      playbackWaveColor: blend(
        theme.colors.fadedText40,
        theme.colors.secondaryBg
      ),
      height:
        waveformPadding > 0
          ? convertRemToPx(theme.sizes.largestElementHeight) -
            2 * waveformPadding
          : "auto",
    }),
    [
      theme.colors.primary,
      theme.colors.bodyText,
      theme.colors.fadedText40,
      theme.colors.secondaryBg,
      theme.sizes.largestElementHeight,
      waveformPadding,
    ]
  )

  /**
   * Keep the loaded recording across theme changes. `WaveSurfer.create` and the
   * recording/playback callbacks read styles from this ref, so they keep stable
   * identities; the `setOptions` effects restyle the live instance.
   */
  const waveformStylesRef = useRef(waveformStyles)
  useEffect(() => {
    waveformStylesRef.current = waveformStyles
  }, [waveformStyles])

  // Reject pending ready waits so a stop() in flight settles instead of
  // hanging on a player that is being replaced or torn down.
  const rejectReadyWaits = useCallback((reason: string): void => {
    const readyResolvers = Array.from(readyResolversRef.current)
    readyResolversRef.current.clear()
    readyResolvers.forEach(resolver => {
      resolver.reject(new RecordingCancelledError(reason))
    })
  }, [])

  const destroy = useCallback((): void => {
    rejectReadyWaits("Waveform controller destroyed")
    setIsPlaybackPlaying(false)

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
    initPromiseRef.current = null
    initGenerationRef.current += 1
    isPlaybackModeRef.current = false
    setCurrentState("idle")
    setCurrentBlob(null)
  }, [rejectReadyWaits])

  const notifyReady = useCallback((): void => {
    const resolvers = Array.from(readyResolversRef.current)
    readyResolversRef.current.clear()
    resolvers.forEach(resolver => {
      resolver.resolve()
    })
  }, [])

  const notifyReadyError = useCallback((error: Error): void => {
    setIsPlaybackPlaying(false)
    const resolvers = Array.from(readyResolversRef.current)
    readyResolversRef.current.clear()
    resolvers.forEach(resolver => {
      resolver.reject(error)
    })
  }, [])

  const configurePlayerEvents = useCallback(
    (player: WaveSurferPlayer): void => {
      const playerEvents: PlayerEvents = {
        onPlay: () => {
          setIsPlaybackPlaying(true)
          void eventsRef.current.onPlaybackPlay?.()
        },
        onPause: () => {
          setIsPlaybackPlaying(false)
          void eventsRef.current.onPlaybackPause?.()
        },
        onFinish: () => {
          setIsPlaybackPlaying(false)
          void eventsRef.current.onPlaybackFinish?.()
        },
        onReady: () => {
          notifyReady()
        },
        onError: (error: Error) => {
          setIsPlaybackPlaying(false)
          notifyReadyError(error)
          void eventsRef.current.onError?.(error)
        },
      }

      player.setEventHandlers(playerEvents)
    },
    [notifyReady, notifyReadyError]
  )

  // Update eventsRef and reconfigure player events when events prop changes.
  // useEffect is required here (not useExecuteWhenChanged) because we're performing
  // a side effect: mutating the WaveSurfer player instance by setting event handlers.
  // This must happen after render commits to ensure the player is in a stable state.
  useEffect(() => {
    eventsRef.current = events
    // Reconfigure player events to avoid stale closures
    if (playerRef.current) {
      configurePlayerEvents(playerRef.current)
    }
  }, [events, configurePlayerEvents])

  const initializeWaveSurfer = useCallback((): Promise<void> => {
    if (isInitializedRef.current) {
      return Promise.resolve()
    }
    if (initPromiseRef.current) {
      return initPromiseRef.current
    }
    const container = containerRef.current
    if (!container) {
      return Promise.resolve()
    }

    const generation = initGenerationRef.current
    const initPromise = (async (): Promise<void> => {
      // destroy() drops this attempt when sampleRate changes and starts
      // another. Wait for that replacement so start() and playback.load don't
      // continue without a backend: AudioInput silently drops a failed start()
      // and shows its error state for a failed load.
      const waitForReplacementInit = async (): Promise<void> => {
        const replacement = initPromiseRef.current
        if (replacement && replacement !== initPromise) {
          await replacement
        }
      }

      try {
        const { WaveSurfer, RecordPluginClass } = await loadWaveSurferModules()
        if (initGenerationRef.current !== generation) {
          await waitForReplacementInit()
          return
        }

        const ws = WaveSurfer.create({
          container,
          waveColor: waveformStylesRef.current.activeColor,
          progressColor: waveformStylesRef.current.progressColor,
          height: waveformStylesRef.current.height,
          barWidth: BAR_WIDTH,
          barGap: BAR_GAP,
          barRadius: BAR_RADIUS,
          cursorWidth: CURSOR_WIDTH,
          interact: true,
        })

        wavesurferRef.current = ws
        isPlaybackModeRef.current = false

        const recordBackend = new WaveSurferRecordBackend({
          sampleRate: effectiveSampleRate,
        })
        recordBackend.initialize(ws, RecordPluginClass)
        recordBackend.setEventHandlers({
          onRecordProgress: (ms: number) => {
            void eventsRef.current.onProgressMs?.(ms)
          },
          onPermissionDenied: () => {
            eventsRef.current.onPermissionDenied()
            setCurrentState("idle")
          },
          onError: (error: Error) => {
            eventsRef.current.onError(error)
            setCurrentState("idle")
          },
        })
        recordBackendRef.current = recordBackend

        const player = new WaveSurferPlayer()
        player.initialize(ws)
        playerRef.current = player

        configurePlayerEvents(player)

        isInitializedRef.current = true
      } catch (error) {
        if (initGenerationRef.current !== generation) {
          await waitForReplacementInit()
          return
        }
        initPromiseRef.current = null
        const err = error instanceof Error ? error : new Error(String(error))
        void eventsRef.current.onError?.(err)
      }
    })()

    initPromiseRef.current = initPromise
    return initPromise
  }, [containerRef, effectiveSampleRate, configurePlayerEvents])

  useEffect(() => {
    void initializeWaveSurfer()

    return (): void => {
      destroy()
    }
  }, [destroy, initializeWaveSurfer])

  useEffect(() => {
    wavesurferRef.current?.setOptions({ height: waveformStyles.height })
  }, [waveformStyles.height])

  useEffect(() => {
    const ws = wavesurferRef.current
    if (!ws) {
      return
    }

    if (currentState === "recording") {
      ws.setOptions({
        waveColor: waveformStyles.activeColor,
        progressColor: waveformStyles.activeColor,
      })
      return
    }

    if (isPlaybackModeRef.current) {
      ws.setOptions({
        interact: true,
        waveColor: waveformStyles.playbackWaveColor,
        progressColor: waveformStyles.progressColor,
      })
      return
    }

    ws.setOptions({
      waveColor: waveformStyles.activeColor,
      progressColor: waveformStyles.progressColor,
    })
  }, [
    currentState,
    waveformStyles.activeColor,
    waveformStyles.progressColor,
    waveformStyles.playbackWaveColor,
  ])

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

    // Reset waveform color for recording mode
    if (wavesurferRef.current) {
      const { activeColor } = waveformStylesRef.current
      wavesurferRef.current.setOptions({
        waveColor: activeColor,
        progressColor: activeColor,
      })
    }

    isPlaybackModeRef.current = false

    await recordBackendRef.current.startRecording()
    setCurrentState("recording")
    setCurrentBlob(null)
    setIsPlaybackPlaying(false)
    void eventsRef.current.onRecordStart?.()
  }, [currentState, initializeWaveSurfer])

  const resetPlayer = useCallback((): void => {
    if (playerRef.current && wavesurferRef.current) {
      playerRef.current.destroy()
      playerRef.current = new WaveSurferPlayer()
      playerRef.current.initialize(wavesurferRef.current)
      rejectReadyWaits("Waveform player reset")
      setIsPlaybackPlaying(false)
      configurePlayerEvents(playerRef.current)
    }
    isPlaybackModeRef.current = false
  }, [configurePlayerEvents, rejectReadyWaits])

  const enterPlaybackMode = useCallback((): void => {
    playerRef.current?.seekToStart()
    setIsPlaybackPlaying(false)
    isPlaybackModeRef.current = true
    if (wavesurferRef.current) {
      const { playbackWaveColor, progressColor } = waveformStylesRef.current
      wavesurferRef.current.setOptions({
        interact: true,
        waveColor: playbackWaveColor,
        progressColor,
      })
    }
  }, [])

  const stop = useCallback(async (): Promise<StopResult> => {
    if (currentState !== "recording") {
      throw new Error("Not currently recording")
    }

    if (!recordBackendRef.current || !playerRef.current) {
      throw new Error("Backends not initialized")
    }

    try {
      const rawBlob = await recordBackendRef.current.stopRecording()
      setCurrentBlob(rawBlob)

      await new Promise<void>((resolve, reject) => {
        if (!playerRef.current) {
          reject(new Error("Player not initialized"))
          return
        }

        const resolver: ReadyResolver = {
          resolve: () => {
            readyResolversRef.current.delete(resolver)
            resolve()
          },
          reject: (error: Error) => {
            readyResolversRef.current.delete(resolver)
            reject(error)
          },
        }

        readyResolversRef.current.add(resolver)

        playerRef.current.load(rawBlob).catch((error: unknown) => {
          readyResolversRef.current.delete(resolver)
          reject(error instanceof Error ? error : new Error(String(error)))
        })
      })

      setCurrentState("idle") // Recording stopped, back to idle state
      setIsPlaybackPlaying(false)
      enterPlaybackMode()

      const durationMs = playerRef.current?.getDuration() ?? 0
      const meta: AudioMeta = {
        durationMs,
        sampleRate:
          typeof effectiveSampleRate === "number" ? effectiveSampleRate : null,
        mimeType: rawBlob.type || "audio/webm",
        size: rawBlob.size,
      }

      const stopResult: StopResult = {
        blob: rawBlob,
        meta,
      }

      void eventsRef.current.onRecordReady?.(rawBlob)
      return stopResult
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      setIsPlaybackPlaying(false)
      setCurrentState("idle")
      // A deliberate cancel is not a failure; reject so callers skip approval.
      if (err instanceof RecordingCancelledError) {
        throw err
      }
      eventsRef.current.onError(err)
      // Return a dummy result to avoid breaking the flow
      return {
        blob: new Blob(),
        meta: {
          durationMs: 0,
          sampleRate: null,
          mimeType: "audio/webm",
          size: 0,
        },
      }
    }
  }, [currentState, enterPlaybackMode, effectiveSampleRate])

  const approve = useCallback(
    async (blob?: Blob): Promise<void> => {
      const blobToUse = blob ?? currentBlob
      if (!blobToUse) {
        const err = new Error("No recorded audio to approve")
        eventsRef.current.onError(err)
        return
      }

      try {
        const wav = await encodeToWav(blobToUse, effectiveSampleRate)
        await eventsRef.current.onApprove?.(wav)

        setCurrentBlob(null)
        setCurrentState("idle")
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        eventsRef.current.onError(err)
      }
    },
    [currentBlob, effectiveSampleRate]
  )

  const cancel = useCallback((): void => {
    if (currentState === "recording") {
      recordBackendRef.current?.cancelRecording()
    }

    resetPlayer()
    setCurrentBlob(null)
    setCurrentState("idle")
    setIsPlaybackPlaying(false)
    isPlaybackModeRef.current = false
    void eventsRef.current.onCancel?.()
  }, [currentState, resetPlayer])

  const playback = useMemo(
    () => ({
      isPlaying: (): boolean => {
        return playerRef.current?.getIsPlaying() ?? false
      },

      play: async (): Promise<void> => {
        if (!playerRef.current) {
          throw new Error("Player not initialized")
        }
        await playerRef.current.play()
      },

      pause: (): void => {
        playerRef.current?.pause()
      },

      load: async (source: Blob | ArrayBuffer | string): Promise<void> => {
        if (!isInitializedRef.current) {
          await initializeWaveSurfer()
        }
        if (!playerRef.current) {
          throw new Error("Player not initialized")
        }

        await playerRef.current.load(source)
        enterPlaybackMode()
      },

      getCurrentTimeMs: (): number => {
        return playerRef.current?.getCurrentTime() ?? 0
      },

      getDurationMs: (): number => {
        return playerRef.current?.getDuration() ?? 0
      },
    }),
    [enterPlaybackMode, initializeWaveSurfer]
  )

  const setEventHandlers = useCallback(
    (newEvents: WaveformControllerEvents): void => {
      eventsRef.current = newEvents
    },
    []
  )

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      destroy()
    }
  }, [destroy])

  return {
    state: currentState,
    isPlaybackPlaying,
    mountRef: containerRef,
    start,
    stop,
    approve,
    cancel,
    destroy,
    playback,
    setEventHandlers,
  }
}
