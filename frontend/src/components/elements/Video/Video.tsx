import React, { ReactElement, useContext, useEffect, useRef } from "react"
import AppContext from "src/components/core/AppContext"
import { Video as VideoProto } from "src/autogen/proto"
import { buildMediaUri } from "src/lib/UriUtil"

const DEFAULT_HEIGHT = 528

export interface VideoProps {
  width: number
  element: VideoProto
}

export default function Video({ element, width }: VideoProps): ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { getBaseUriParts } = useContext(AppContext)

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
      src={buildMediaUri(url, getBaseUriParts())}
      className="stVideo"
      style={{ width, height: width === 0 ? DEFAULT_HEIGHT : undefined }}
    />
  )
}
