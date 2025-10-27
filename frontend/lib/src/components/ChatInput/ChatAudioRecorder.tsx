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

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import type { AudioMeta, WaveformController } from "~lib/components/audio"

import { LOG } from "./logger"
import {
  StyledChatAudioButton,
  StyledChatAudioContainer,
  StyledChatAudioControls,
  StyledChatAudioWave,
} from "./styled-components"

export interface ChatAudioRecorderProps {
  controller: WaveformController
  isRecording: boolean
  onStart: () => Promise<void>
  onApprove: (payload: { blob: Blob; meta: AudioMeta }) => Promise<void>
  onCancel: () => void
  disabled?: boolean
}

const ChatAudioRecorder: React.FC<ChatAudioRecorderProps> = ({
  controller,
  isRecording,
  onStart,
  onApprove,
  onCancel,
  disabled = false,
}) => {
  const [pending, setPending] = useState(false)
  const isMountedRef = useRef(true)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      controller.destroy()
    }
  }, [controller])

  // Start recording when isRecording becomes true
  useEffect(() => {
    if (!isRecording) {
      return
    }

    let cancelled = false

    const startRecording = async (): Promise<void> => {
      if (cancelled) {
        return
      }

      setPending(true)
      try {
        await controller.start()
        if (!cancelled) {
          await Promise.resolve(onStart())
        }
      } catch {
        if (!cancelled) {
          onCancel()
        }
      } finally {
        if (!cancelled && isMountedRef.current) {
          setPending(false)
        }
      }
    }

    startRecording().catch(error => {
      // Errors are handled internally by calling onCancel()
      // Log for debugging and monitoring
      LOG.error("Error starting audio recording:", error)
    })

    return () => {
      cancelled = true
    }
  }, [isRecording, controller, onStart, onCancel])

  const handleCancel = useCallback(() => {
    if (pending || disabled) {
      return
    }

    setPending(true)
    try {
      controller.cancel()
    } finally {
      if (isMountedRef.current) {
        setPending(false)
      }
      onCancel()
    }
  }, [controller, disabled, onCancel, pending])

  const handleApprove = useCallback(async () => {
    if (pending || disabled) {
      return
    }

    setPending(true)
    try {
      const { blob, meta } = await controller.stop()
      if (!blob) {
        throw new Error("No audio data available")
      }
      await Promise.resolve(onApprove({ blob, meta }))
    } catch {
      controller.cancel()
      onCancel()
    } finally {
      if (isMountedRef.current) {
        setPending(false)
      }
    }
  }, [controller, disabled, onApprove, onCancel, pending])

  // Don't render anything if not recording - keeps component mounted but hidden
  if (!isRecording) {
    return (
      <div style={{ display: "none" }}>
        <StyledChatAudioWave
          className="stChatAudio__wave"
          ref={controller.mountRef}
          aria-hidden
        />
      </div>
    )
  }

  return (
    <StyledChatAudioContainer
      className="stChatAudio__container"
      role="group"
      aria-label="Recording audio"
      data-testid="chat-audio-recorder"
    >
      <StyledChatAudioWave
        className="stChatAudio__wave"
        ref={controller.mountRef}
        aria-hidden
      />
      <StyledChatAudioControls className="stChatAudio__controls">
        <StyledChatAudioButton
          type="button"
          className="stChatAudio__cancel"
          onClick={handleCancel}
          aria-label="Cancel"
          disabled={pending || disabled}
          variant="cancel"
        >
          Cancel
        </StyledChatAudioButton>
        <StyledChatAudioButton
          type="button"
          className="stChatAudio__approve"
          onClick={() => {
            handleApprove().catch(_error => {
              // Error is already handled in handleApprove
              onCancel()
            })
          }}
          aria-label="Approve"
          disabled={pending || disabled}
          variant="approve"
        >
          Approve
        </StyledChatAudioButton>
      </StyledChatAudioControls>
    </StyledChatAudioContainer>
  )
}

export default ChatAudioRecorder
