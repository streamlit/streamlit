/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { IAudio } from "autogen/proto"
import { buildMediaUri } from "lib/UriUtil"
import { requireNonNull } from "lib/utils"
import React, { ReactElement, useEffect, useRef } from "react"

export interface AudioProps {
  width: number
  element: IAudio
}

export default function Audio({ element, width }: AudioProps): ReactElement {
  const audioRef = useRef<HTMLAudioElement>(null)
  const startTime = requireNonNull(element.startTime)
  const url = requireNonNull(element.url)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = startTime
    }
  }, [startTime])

  const uri = buildMediaUri(url)
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
