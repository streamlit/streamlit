/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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

import React from "react"
import { Map as ImmutableMap } from "immutable"

interface Props {
  width: number
  element: ImmutableMap<string, any>
}

class Video extends React.PureComponent<Props> {
  private videoRef = React.createRef<HTMLVideoElement>()

  public componentDidMount = (): void => {
    this.updateTime()
  }

  public componentDidUpdate = (): void => {
    this.updateTime()
  }

  private updateTime(): void {
    if (this.videoRef.current) {
      const startTime = this.props.element.get("startTime")
      this.videoRef.current.currentTime = startTime
    }
  }

  public render(): React.ReactNode {
    /* Element may contain "url" or "data" property. */

    const { element, width } = this.props

    if (element.get("url")) {
      /* is this a YouTube link? if so we need a fancier tag. 
         NOTE: This part assumes the URL is already an "embed" link.
      */
      if (element.get("url").includes("youtube.com")) {
        const height = width * 0.75
        const wid -> width
        return (
          <iframe
            src={element.get("url")}
            width={wid}
            height={height}
            frameBorder="0"
            allow="autoplay; encrypted-media"
            allowFullScreen
          ></iframe>
        )
      } else {
        return (
          <video
            ref={this.videoRef}
            controls
            src={element.get("url")}
            className="stVideo"
            style={{ width }}
          />
        )
      }
    }

    const dataUrl =
      "data:" + element.get("format") + ";base64," + element.get("data")
    return (
      <video
        ref={this.videoRef}
        controls
        src={dataUrl}
        className="stVideo"
        style={{ width }}
      />
    )
  }
}

export default Video
