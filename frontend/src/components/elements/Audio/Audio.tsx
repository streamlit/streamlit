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

class Audio extends React.PureComponent<Props> {
  private audioRef = React.createRef<HTMLAudioElement>()

  public componentDidMount = (): void => {
    this.updateTime()
  }

  public componentDidUpdate = (): void => {
    this.updateTime()
  }

  private updateTime(): void {
    if (this.audioRef.current) {
      const startTime = this.props.element.get("startTime")
      this.audioRef.current.currentTime = startTime
    }
  }

  public render(): React.ReactNode {
    const { element, width } = this.props
    const src = element.get("url")
      ? element.get("url")
      : "data:" + element.get("format") + ";base64," + element.get("data")

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
