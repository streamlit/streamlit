/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React, { ReactElement, useEffect, useRef } from "react"
import { Video as VideoProto } from "src/autogen/proto"
import { StreamlitEndpoints } from "src/lib/StreamlitEndpoints"

const DEFAULT_HEIGHT = 528

export interface VideoProps {
  endpoints: StreamlitEndpoints
  width: number
  element: VideoProto
}

export default function Video({
  element,
  width,
  endpoints,
}: VideoProps): ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null)

  /* Element may contain "url" or "data" property. */

  const { type, url } = element

  useEffect(() => {
    const videoNode = videoRef.current

    const setStartTime: () => void = () => {
      if (videoNode) {
        // setStartTime
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

  const getYoutubeSrc = (url: string): string => {
    const { startTime } = element
    if (startTime) {
      return `${url}?start=${startTime}`
    }
    return url
  }

  /* Is this a YouTube link? If so we need a fancier tag.
       NOTE: This part assumes the URL is already an "embed" link.
    */
  if (type === VideoProto.Type.YOUTUBE_IFRAME) {
    // At some point the width 0 will be passed to this component
    // which is caused by the AutoSizer of the VerticalLayout
    // Width 0 will result in height being 0, which results in issue
    // https://github.com/streamlit/streamlit/issues/5069
    // To avoid this, when we detect width is 0, we set height to 528,
    // which is default height based on the default streamlit width
    const height = width !== 0 ? width * 0.75 : DEFAULT_HEIGHT

    return (
      <iframe
        title={url}
        src={getYoutubeSrc(url)}
        width={width}
        height={height}
        frameBorder="0"
        allow="autoplay; encrypted-media"
        allowFullScreen
      />
    )
  }

  return (
    <video
      ref={videoRef}
      controls
      src={endpoints.buildMediaURL(url)}
      className="stVideo"
      style={{ width, height: width === 0 ? DEFAULT_HEIGHT : undefined }}
    />
  )
}
