/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React, { ReactElement, useEffect, useMemo, useRef } from "react"
import { Audio as AudioProto } from "@streamlit/lib/src/proto"
import { StreamlitEndpoints } from "@streamlit/lib/src/StreamlitEndpoints"
import { WidgetStateManager as ElementStateManager } from "@streamlit/lib/src/WidgetStateManager"

export interface AudioProps {
  endpoints: StreamlitEndpoints
  width: number
  element: AudioProto
  elementMgr: ElementStateManager
}

export default function Audio({
  element,
  width,
  endpoints,
  elementMgr,
}: AudioProps): ReactElement {
  const audioRef = useRef<HTMLAudioElement>(null)

  const { startTime, endTime, loop, autoplay } = element

  const preventAutoplay = useMemo<boolean>(() => {
    if (!element.id) {
      // Elements without an ID should never autoplay
      return true
    }

    // Recover the state in case this component got unmounted
    // and mounted again for the same element.
    const preventAutoplay = elementMgr.getElementState(
      element.id,
      "preventAutoplay"
    )

    if (!preventAutoplay) {
      // Set the state to prevent autoplay in case there is an unmount + mount
      // for the same element.
      elementMgr.setElementState(element.id, "preventAutoplay", true)
    }
    return preventAutoplay ?? false
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
    if (!audioNode) return

    // Flag to avoid calling 'audioNode.pause()' multiple times
    let stoppedByEndTime = false

    const handleTimeUpdate = (): void => {
      if (endTime > 0 && audioNode.currentTime >= endTime) {
        if (loop) {
          // If loop is true and we reached 'endTime', reset to 'startTime'
          audioNode.currentTime = startTime || 0
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
    if (!audioNode) return

    // Loop the audio when it has ended
    const handleAudioEnd = (): void => {
      if (loop) {
        audioNode.currentTime = startTime || 0 // Reset to startTime or to the start if not specified
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

  const uri = endpoints.buildMediaURL(element.url)

  return (
    <audio
      data-testid="stAudio"
      id="audio"
      ref={audioRef}
      controls
      autoPlay={autoplay && !preventAutoplay}
      src={uri}
      className="stAudio"
      style={{ width }}
    />
  )
}
