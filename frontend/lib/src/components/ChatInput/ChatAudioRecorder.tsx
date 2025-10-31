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
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"

import type { AudioMeta, WaveformController } from "~lib/components/audio"
import { LOG } from "~lib/components/ChatInput/logger"

import {
  StyledChatAudioButton,
  StyledChatAudioContainer,
  StyledChatAudioControls,
  StyledChatAudioWave,
} from "./styled-components"

export interface ChatAudioRecorderProps {
  controller: WaveformController
  onStart?: () => Promise<void>
  onApprove: (payload: { blob: Blob; meta: AudioMeta }) => Promise<void>
  onCancel: () => void
  onRecordingStateChange?: (isRecording: boolean) => void
  disabled?: boolean
}

export interface ChatAudioRecorderRef {
  startRecording: () => Promise<void>
  readonly isRecording: boolean
}

const ChatAudioRecorder = forwardRef<
  ChatAudioRecorderRef,
  ChatAudioRecorderProps
>(
  (
    {
      controller,
      onStart,
      onApprove,
      onCancel,
      onRecordingStateChange,
      disabled = false,
    },
    ref
  ) => {
    const [isRecording, setIsRecording] = useState(false)
    const [pending, setPending] = useState(false)
    const isMountedRef = useRef(true)
    const abortControllerRef = useRef<AbortController | null>(null)

    // Notify parent of recording state changes
    useEffect(() => {
      onRecordingStateChange?.(isRecording)
    }, [isRecording, onRecordingStateChange])

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        isMountedRef.current = false
        abortControllerRef.current?.abort()
        controller.destroy()
      }
    }, [controller])

    const startRecording = useCallback(async (): Promise<void> => {
      // Cancel any previous recording attempt and create new controller
      abortControllerRef.current?.abort()
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      setIsRecording(true)
      setPending(true)
      try {
        await controller.start()
        if (!abortController.signal.aborted && onStart) {
          await Promise.resolve(onStart())
        }
      } catch (error) {
        LOG.error("ChatAudioRecorder: Failed to start recording", error)
        if (!abortController.signal.aborted) {
          setIsRecording(false)
          onCancel()
        }
      } finally {
        if (!abortController.signal.aborted && isMountedRef.current) {
          setPending(false)
        }
      }
    }, [controller, onStart, onCancel])

    // Expose startRecording method and isRecording state to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        startRecording,
        isRecording,
      }),
      [startRecording, isRecording]
    )

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
          setIsRecording(false)
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
          setIsRecording(false)
        }
      }
    }, [controller, disabled, onApprove, onCancel, pending])

    const handleApproveClick = useCallback(() => {
      void handleApprove()
    }, [handleApprove])

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
            onClick={handleApproveClick}
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
)

ChatAudioRecorder.displayName = "ChatAudioRecorder"

export default ChatAudioRecorder
