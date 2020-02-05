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

import React, { PureComponent, ReactNode } from "react"
import { Map as ImmutableMap } from "immutable"

export interface Props {
  width: number
  element: ImmutableMap<string, any>
}

class Audio extends PureComponent<Props> {
  private audioRef = React.createRef<HTMLAudioElement>()

  public componentDidMount = (): void => {
    this.updateTime()
  }

  public componentDidUpdate = (): void => {
    this.updateTime()
  }

  private updateTime(): void {
    if (this.audioRef.current) {
      const { element } = this.props

      this.audioRef.current.currentTime = element.get("startTime")
    }
  }

  public render(): ReactNode {
    const { element, width } = this.props
    const url = element.get("url")
    const src = url
      ? url
      : `data: ${element.get("format")};base64,${element.get("data")}`

    return (
      <audio
        ref={this.audioRef}
        controls
        src={src}
        className="stAudio"
        style={{ width }}
      />
    )
  }
}

export default Audio
