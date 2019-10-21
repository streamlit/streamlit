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
import { Video as VideoProto } from "autogen/proto"

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

    /* Is this a YouTube link? If so we need a fancier tag.
       NOTE: This part assumes the URL is already an "embed" link.
    */
    if (element.get("type") === VideoProto.Type.YOUTUBE_IFRAME) {
      const height = width * 0.75
      const src = element.get("startTime")
        ? `${element.get("url")}?start=${element.get("startTime")}`
        : element.get("url")
      return (
        <iframe
          title={element.get("url")}
          src={src}
          width={width}
          height={height}
          frameBorder="0"
          allow="autoplay; encrypted-media"
          allowFullScreen
        ></iframe>
      )
    }

    const src = element.get("url")
      ? element.get("url")
      : "data:" + element.get("format") + ";base64," + element.get("data")

    return (
      <video
        ref={this.videoRef}
        controls
        src={src}
        className="stVideo"
        style={{ width }}
      />
    )
  }
}

export default Video
