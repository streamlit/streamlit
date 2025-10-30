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
  ChangeEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { AttachFile, Mic, Send } from "@emotion-icons/material-outlined"
import { LOG } from "~lib/log"

import { type AudioMeta, useWaveformController } from "~lib/components/audio"

import ChatAudioRecorder from "./ChatAudioRecorder"
import {
  StyledChatComposer,
  StyledComposerActions,
  StyledComposerButton,
  StyledComposerInput,
  StyledComposerRow,
  StyledHiddenFileInput,
} from "./styled-components"

// MIME type to file extension mapping for audio formats
const MIME_TO_EXTENSION: Record<string, string> = {
  "audio/webm": "webm",
  "audio/webm;codecs=opus": "webm",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/ogg;codecs=opus": "ogg",
}

/**
 * Get file extension from MIME type.
 * Handles MIME types with parameters (e.g., "audio/webm;codecs=opus").
 * Falls back to "wav" for unknown MIME types.
 */
const getExtensionFromMimeType = (mimeType: string): string => {
  // Try exact match first (handles MIME types with parameters)
  if (MIME_TO_EXTENSION[mimeType]) {
    return MIME_TO_EXTENSION[mimeType]
  }

  // Try base MIME type without parameters
  const baseMimeType = mimeType.split(";")[0].trim()
  return MIME_TO_EXTENSION[baseMimeType] || "wav"
}

export interface ChatSubmitPayload {
  text: string
  files: File[]
  audio: File | null
}

export interface ChatComposerProps {
  sendChatSubmit: (payload: ChatSubmitPayload) => Promise<void>
  acceptAudio?: boolean
  disabled?: boolean
  placeholder?: string
}

const ChatComposer: React.FC<ChatComposerProps> = ({
  sendChatSubmit,
  acceptAudio = false,
  disabled = false,
  placeholder = "Send a message",
}) => {
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const waveformContainerRef = useRef<HTMLDivElement>(null)

  const [text, setText] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const controller = useWaveformController({
    containerRef: waveformContainerRef,
  })

  // Cleanup controller on unmount
  useEffect(() => {
    return () => {
      controller.destroy()
    }
  }, [controller])

  const canInteract = !disabled && !isSubmitting
  const controlsDisabled = !canInteract || isRecording

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [])

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setText(event.target.value)
    },
    []
  )

  const handleFilesSelected = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files
      if (!selected) {
        return
      }
      setFiles(prev => [...prev, ...Array.from(selected)])
      event.target.value = ""
    },
    []
  )

  const handleAttachClick = useCallback(() => {
    if (controlsDisabled) {
      return
    }
    fileInputRef.current?.click()
  }, [controlsDisabled])

  const resetState = useCallback(() => {
    setText("")
    focusInput()
  }, [focusInput])

  const handleSubmit = useCallback(async () => {
    if (controlsDisabled || (!text.trim() && files.length === 0)) {
      return
    }

    setIsSubmitting(true)
    try {
      await sendChatSubmit({
        text,
        files,
        audio: null,
      })
      setFiles([])
      resetState()
    } catch (error) {
      LOG.error("ChatComposer: Failed to submit chat", error)
    } finally {
      setIsSubmitting(false)
    }
  }, [controlsDisabled, files, resetState, sendChatSubmit, text])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.defaultPrevented) {
        return
      }

      if (controlsDisabled) {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault()
        }
        return
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        handleSubmit()
      }
    },
    [controlsDisabled, handleSubmit]
  )

  const handleRecordingStart = useCallback(async () => {
    // Called when recording actually starts (after permissions granted)
  }, [])

  const handleMicClick = useCallback(() => {
    if (!acceptAudio || controlsDisabled || isRecording) {
      return
    }
    setIsRecording(true)
  }, [acceptAudio, controlsDisabled, isRecording])

  const handleRecordingCancel = useCallback(() => {
    setIsRecording(false)
    focusInput()
  }, [focusInput])

  const handleRecordingApprove = useCallback(
    async ({ blob, meta }: { blob: Blob; meta: AudioMeta }) => {
      setIsSubmitting(true)
      try {
        const extension = getExtensionFromMimeType(meta.mimeType)
        const audioFile = new File([blob], `chat-audio.${extension}`, {
          type: meta.mimeType,
        })

        await sendChatSubmit({
          text,
          files,
          audio: audioFile,
        })
        setFiles([])
        setText("")
        focusInput()
      } catch (error) {
        LOG.error("ChatComposer: Failed to submit audio recording", error)
      } finally {
        setIsSubmitting(false)
        setIsRecording(false)
      }
    },
    [files, focusInput, sendChatSubmit, text]
  )

  const hasPendingContent = text.trim().length > 0 || files.length > 0

  return (
    <StyledChatComposer
      className={`stChatComposer${isRecording ? " stChatComposer--recording" : ""}`}
      data-testid="chat-composer"
    >
      <StyledComposerRow>
        <StyledComposerInput
          ref={inputRef}
          placeholder={placeholder}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          aria-label={placeholder}
          disabled={controlsDisabled}
          data-testid="chat-composer-input"
        />
        <StyledComposerActions>
          <StyledComposerButton
            type="button"
            onClick={handleAttachClick}
            aria-label="Attach file"
            disabled={controlsDisabled}
            data-testid="chat-composer-attach"
          >
            <AttachFile size="20" aria-hidden />
          </StyledComposerButton>
          {acceptAudio ? (
            <StyledComposerButton
              type="button"
              onClick={handleMicClick}
              aria-label="Record audio"
              disabled={controlsDisabled || isRecording}
              data-testid="chat-composer-mic"
            >
              <Mic size="20" aria-hidden />
            </StyledComposerButton>
          ) : null}
          <StyledComposerButton
            type="button"
            onClick={() => {
              void handleSubmit()
            }}
            aria-label="Send"
            disabled={controlsDisabled || !hasPendingContent}
            data-testid="chat-composer-send"
            variant="primary"
          >
            <Send size="20" aria-hidden />
          </StyledComposerButton>
        </StyledComposerActions>
      </StyledComposerRow>

      <StyledHiddenFileInput
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFilesSelected}
        data-testid="chat-composer-file-input"
      />

      {acceptAudio ? (
        <ChatAudioRecorder
          controller={controller}
          isRecording={isRecording}
          onStart={handleRecordingStart}
          onApprove={handleRecordingApprove}
          onCancel={handleRecordingCancel}
          disabled={disabled || isSubmitting}
        />
      ) : null}
    </StyledChatComposer>
  )
}

export default ChatComposer
