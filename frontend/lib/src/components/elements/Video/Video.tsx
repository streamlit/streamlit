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

import { ISubtitleTrack, Video as VideoProto } from "@streamlit/protobuf"

import { useCrossOriginAttribute } from "~lib/hooks/useCrossOriginAttribute"
import { StreamlitEndpoints } from "~lib/StreamlitEndpoints"
import { WidgetStateManager as ElementStateManager } from "~lib/WidgetStateManager"

import { StyledVideoIframe } from "./styled-components"

const LOG = getLogger("Video")
export interface VideoProps {
  endpoints: StreamlitEndpoints
  element: VideoProto
  elementMgr: ElementStateManager
}

export interface Subtitle {
  label: string
  url: string
}

const VIDEO_STYLE = { width: "100%" }

function Video({
  element,
  endpoints,
  elementMgr,
}: Readonly<VideoProps>): ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null)

  /* Element may contain "url" or "data" property. */
  const { type, url, startTime, subtitles, endTime, loop, autoplay, muted } =
    element

  let crossOrigin = useCrossOriginAttribute(url)

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

  // Create a stable dependency for checking subtitle source urls
  const subtitleSrcArrString = useMemo(() => {
    if (!subtitles) {
      return JSON.stringify([])
    }

    return JSON.stringify(
      subtitles.map(subtitle => endpoints.buildMediaURL(`${subtitle.url}`))
    )
  }, [subtitles, endpoints])

  // Check the video's subtitles for load errors
  useEffect(() => {
    const subtitleSrcArr: string[] = JSON.parse(subtitleSrcArrString)
    if (subtitleSrcArr.length === 0) return

    // Since there is no onerror event for track elements, we can't use the onerror event
    // to catch src url load errors. Catch with direct check instead.
    subtitleSrcArr.forEach(subtitleSrc => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
      endpoints.checkSourceUrlResponse(subtitleSrc, "Video Subtitle")
    })
  }, [subtitleSrcArrString, endpoints])

  // Handle startTime changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = startTime
    }
  }, [startTime])

  useEffect(() => {
    const videoNode = videoRef.current

    const setStartTime: () => void = () => {
      if (videoNode) {
        videoNode.currentTime = element.startTime
      }
    }

    if (videoNode) {
      videoNode.addEventListener("loadedmetadata", setStartTime)
    }

    return () => {
      if (videoNode) {
        videoNode.removeEventListener("loadedmetadata", setStartTime)
      }
    }
  }, [element])

  // Stop the video at 'endTime' and handle loop
  useEffect(() => {
    const videoNode = videoRef.current
    if (!videoNode) {
      return
    }

    // Flag to avoid calling 'videoNode.pause()' multiple times
    let stoppedByEndTime = false

    const handleTimeUpdate = (): void => {
      if (endTime > 0 && videoNode.currentTime >= endTime) {
        if (loop) {
          // If loop is true and we reached 'endTime', reset to 'startTime'
          videoNode.currentTime = startTime || 0
          // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
          videoNode.play()
        } else if (!stoppedByEndTime) {
          stoppedByEndTime = true
          videoNode.pause()
        }
      }
    }

    if (endTime > 0) {
      videoNode.addEventListener("timeupdate", handleTimeUpdate)
    }

    return () => {
      if (videoNode && endTime > 0) {
        videoNode.removeEventListener("timeupdate", handleTimeUpdate)
      }
    }
  }, [endTime, loop, startTime])

  // Handle looping the video
  useEffect(() => {
    const videoNode = videoRef.current
    if (!videoNode) {
      return
    }

    // Loop the video when it has ended
    const handleVideoEnd = (): void => {
      if (loop) {
        videoNode.currentTime = startTime || 0 // Reset to startTime or to the start if not specified
        // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
        videoNode.play()
      }
    }

    videoNode.addEventListener("ended", handleVideoEnd)

    return () => {
      if (videoNode) {
        videoNode.removeEventListener("ended", handleVideoEnd)
      }
    }
  }, [loop, startTime])

  const getYoutubeSrc = (urlArg: string): string => {
    const youtubeUrl = new URL(urlArg)

    if (startTime && !isNaN(startTime)) {
      youtubeUrl.searchParams.append("start", startTime.toString())
    }

    if (endTime && !isNaN(endTime)) {
      youtubeUrl.searchParams.append("end", endTime.toString())
    }

    if (loop) {
      youtubeUrl.searchParams.append("loop", "1")
      // When using the loop parameter, YouTube requires the playlist parameter to be set to the same video ID
      const videoId = youtubeUrl.pathname.split("/").pop()

      if (videoId) {
        youtubeUrl.searchParams.append("playlist", videoId)
      }
    }

    if (autoplay) {
      youtubeUrl.searchParams.append("autoplay", "1")
    }

    if (muted) {
      youtubeUrl.searchParams.append("mute", "1")
    }

    return youtubeUrl.toString()
  }

  // Is this a YouTube link? If so we need a fancier tag.
  // NOTE: This part assumes the URL is already an "embed" link.
  if (type === VideoProto.Type.YOUTUBE_IFRAME) {
    return (
      <StyledVideoIframe
        className="stVideo"
        data-testid="stVideo"
        title={url}
        src={getYoutubeSrc(url)}
        allow="autoplay; encrypted-media"
        allowFullScreen
      />
    )
  }

  const handleVideoError = (
    e: React.SyntheticEvent<HTMLVideoElement>
  ): void => {
    const videoUrl = e.currentTarget.src
    LOG.error(`Client Error: Video source error - ${videoUrl}`)
    endpoints.sendClientErrorToHost(
      "Video",
      "Video source failed to load",
      "onerror triggered",
      videoUrl
    )
  }

  // When in dev mode we set crossOrigin to "anonymous" to avoid CORS issues
  // when streamlit frontend and backend are running on different ports
  if (process.env.NODE_ENV === "development" && subtitles.length > 0) {
    crossOrigin = "anonymous"
  }

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      className="stVideo"
      data-testid="stVideo"
      ref={videoRef}
      controls
      muted={muted}
      autoPlay={autoplay && !preventAutoplay}
      src={endpoints.buildMediaURL(url)}
      style={VIDEO_STYLE}
      crossOrigin={crossOrigin}
      onError={handleVideoError}
    >
      {subtitles &&
        subtitles.map((subtitle: ISubtitleTrack, idx: number) => (
          <track
            // TODO: Update to match React best practices
            // eslint-disable-next-line @eslint-react/no-array-index-key
            key={idx}
            kind="captions"
            src={endpoints.buildMediaURL(`${subtitle.url}`)}
            label={`${subtitle.label}`}
            default={idx === 0}
            data-testid="stVideoSubtitle"
          />
        ))}
    </video>
  )
}

export default memo(Video)
