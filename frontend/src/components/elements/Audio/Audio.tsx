import React, { ReactElement, useContext, useEffect, useRef } from "react"
import { Audio as AudioProto } from "src/autogen/proto"
import AppContext from "src/components/core/AppContext"
import { buildMediaUri } from "src/lib/UriUtil"

export interface AudioProps {
  width: number
  element: AudioProto
}

export default function Audio({ element, width }: AudioProps): ReactElement {
  const audioRef = useRef<HTMLAudioElement>(null)
  const { getBaseUriParts } = useContext(AppContext)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = element.startTime
    }
  }, [element.startTime])

  const uri = buildMediaUri(element.url, getBaseUriParts())
  return (
    <audio
      id="audio"
      ref={audioRef}
      controls
      src={uri}
      className="stAudio"
      style={{ width }}
    />
  )
}
