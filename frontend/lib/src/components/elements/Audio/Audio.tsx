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

import React, { memo, ReactElement, useEffect, useMemo, useRef } from "react"

import { getLogger } from "loglevel"

import { Audio as AudioProto } from "@streamlit/protobuf"

import { useCrossOriginAttribute } from "~lib/hooks/useCrossOriginAttribute"
import { StreamlitEndpoints } from "~lib/StreamlitEndpoints"
import { WidgetStateManager as ElementStateManager } from "~lib/WidgetStateManager"

import { StyledAudio, StyledAudioContainer } from "./styled-components"

const LOG = getLogger("Audio")
export interface AudioProps {
  endpoints: StreamlitEndpoints
  element: AudioProto
  elementMgr: ElementStateManager
}

function Audio({
  element,
  endpoints,
  elementMgr,
}: Readonly<AudioProps>): ReactElement {
  const audioRef = useRef<HTMLAudioElement>(null)

  const { startTime, endTime, loop, autoplay } = element

  const preventAutoplay = useMemo<boolean>(() => {
    if (!element.id) {
      // Elements without an ID should never autoplay
      return true
    }

    // Recover the state in case this component got unmounted
    // and mounted again for the same element.
    const preventAutoplayState = elementMgr.getElementState(
      element.id,
      "preventAutoplay"
    )

    if (!preventAutoplayState) {
      // Set the state to prevent autoplay in case there is an unmount + mount
      // for the same element.
      elementMgr.setElementState(element.id, "preventAutoplay", true)
    }
    return preventAutoplayState ?? false
  }, [element.id, elementMgr])

  // Handle startTime changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = startTime
    }
  }, [startTime])

  useEffect(() => {
    const audioNode = audioRef.current

    const setStartTime: () => void = () => {
      if (audioNode) {
        // setStartTime
        audioNode.currentTime = element.startTime
      }
    }

    if (audioNode) {
      audioNode.addEventListener("loadedmetadata", setStartTime)
    }

    return () => {
      if (audioNode) {
        audioNode.removeEventListener("loadedmetadata", setStartTime)
      }
    }
  }, [element])

  // Stop the audio at 'endTime' and handle loop
  useEffect(() => {
    const audioNode = audioRef.current
    if (!audioNode) {
      return
    }

    // Flag to avoid calling 'audioNode.pause()' multiple times
    let stoppedByEndTime = false

    const handleTimeUpdate = (): void => {
      if (endTime > 0 && audioNode.currentTime >= endTime) {
        if (loop) {
          // If loop is true and we reached 'endTime', reset to 'startTime'
          audioNode.currentTime = startTime || 0
          // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
          audioNode.play()
        } else if (!stoppedByEndTime) {
          stoppedByEndTime = true
          audioNode.pause()
        }
      }
    }

    if (endTime > 0) {
      audioNode.addEventListener("timeupdate", handleTimeUpdate)
    }

    return () => {
      if (audioNode && endTime > 0) {
        audioNode.removeEventListener("timeupdate", handleTimeUpdate)
      }
    }
  }, [endTime, loop, startTime])

  // Handle looping the audio
  useEffect(() => {
    const audioNode = audioRef.current
    if (!audioNode) {
      return
    }

    // Loop the audio when it has ended
    const handleAudioEnd = (): void => {
      if (loop) {
        audioNode.currentTime = startTime || 0 // Reset to startTime or to the start if not specified
        // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
        audioNode.play()
      }
    }

    audioNode.addEventListener("ended", handleAudioEnd)

    return () => {
      if (audioNode) {
        audioNode.removeEventListener("ended", handleAudioEnd)
      }
    }
  }, [loop, startTime])

  const crossOrigin = useCrossOriginAttribute(element.url)
  const uri = endpoints.buildMediaURL(element.url)

  const handleAudioError = (
    e: React.SyntheticEvent<HTMLAudioElement>
  ): void => {
    const audioUrl = e.currentTarget.src
    LOG.error(`Client Error: Audio source error - ${audioUrl}`)
    endpoints.sendClientErrorToHost(
      "Audio",
      "Audio source failed to load",
      "onerror triggered",
      audioUrl
    )
  }

  return (
    <StyledAudioContainer>
      <StyledAudio
        className="stAudio"
        data-testid="stAudio"
        ref={audioRef}
        controls
        autoPlay={autoplay && !preventAutoplay}
        src={uri}
        onError={handleAudioError}
        crossOrigin={crossOrigin}
      />
    </StyledAudioContainer>
  )
}

export default memo(Audio)
