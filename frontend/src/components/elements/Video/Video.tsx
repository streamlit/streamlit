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

import React, { createRef, PureComponent, ReactNode } from "react"
import { Map as ImmutableMap } from "immutable"
import { Video as VideoProto } from "autogen/proto"
import {
  buildHttpUri,
  getWindowBaseUriParts as get_base_uri_parts,
} from "lib/UriUtil"

export interface Props {
  width: number
  element: ImmutableMap<string, any>
}

class Video extends PureComponent<Props> {
  private videoRef = createRef<HTMLVideoElement>()

  public componentDidMount = (): void => {
    this.updateTime()
  }

  public componentDidUpdate = (): void => {
    this.updateTime()
  }

  private updateTime = (): void => {
    if (this.videoRef.current) {
      const { element } = this.props

      this.videoRef.current.currentTime = element.get("startTime")
    }
  }

  private getYoutubeSrc = (): string => {
    const { element } = this.props
    const startTime = element.get("startTime")
    const url = element.get("url")

    if (startTime) {
      return `${url}?start=${startTime}`
    }

    return url
  }

  private getVideoURI = (): string => {
    const { element } = this.props
    const url = element.get("url")

    if (url.startsWith("/media")) {
      return buildHttpUri(get_base_uri_parts(), url)
    }

    return url
  }

  public render(): ReactNode {
    /* Element may contain "url" or "data" property. */

    const { element, width } = this.props
    const url = element.get("url")
    const type = element.get("type")

    /* Is this a YouTube link? If so we need a fancier tag.
       NOTE: This part assumes the URL is already an "embed" link.
    */
    if (type === VideoProto.Type.YOUTUBE_IFRAME) {
      const height = width * 0.75

      return (
        <iframe
          title={url}
          src={this.getYoutubeSrc()}
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
        ref={this.videoRef}
        controls
        src={this.getVideoURI()}
        className="stVideo"
        style={{ width }}
      />
    )
  }
}

export default Video
