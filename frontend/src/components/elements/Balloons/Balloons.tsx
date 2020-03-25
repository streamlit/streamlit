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

import React from "react"
import { Balloons as BalloonsProto } from "autogen/proto"
import { Map as ImmutableMap } from "immutable"
import BalloonEmoji from "assets/img/emoji/emoji_u1f388.png"
import HappyFaceEmoji from "assets/img/emoji/emoji_u1f604.png"
import StarFaceEmoji from "assets/img/emoji/emoji_u1f929.png"
import CoolFaceEmoji from "assets/img/emoji/emoji_u1f60e.png"
import "./Balloons.scss"

export const NUM_BALLOONS = 15
const POS_MIN_VW = 30
const POS_MAX_VW = 70
export const DELAY_MAX_MS = 500

const BALLOON_PROB = 0.5

export const MAX_ANIMATION_DURATION_MS = 1000 // see CSS

const BALLOONS_INDICES = Array.from({ length: NUM_BALLOONS })

const BALLOON_IMAGES: string[] = []
BALLOON_IMAGES[0] = "" // 0 means random
BALLOON_IMAGES[BalloonsProto.Type.BALLOON] = BalloonEmoji
BALLOON_IMAGES[BalloonsProto.Type.HAPPY_FACE] = HappyFaceEmoji
BALLOON_IMAGES[BalloonsProto.Type.STAR_FACE] = StarFaceEmoji
BALLOON_IMAGES[BalloonsProto.Type.COOL_FACE] = CoolFaceEmoji

export interface Props {
  width: number
  element: ImmutableMap<string, any>
}

interface State {
  drawnId: boolean
}

class Balloons extends React.PureComponent<Props, State> {
  public readonly state: State = {
    drawnId: true,
  }

  public render(): React.ReactNode {
    if (this.state.drawnId === this.props.element.get("executionId")) {
      return ""
    }

    this.setTimer()

    return (
      <div className="balloons">
        {BALLOONS_INDICES.map((_, i) => (
          <img
            className="balloon"
            key={i}
            src={getBalloonUrl(this.props.element)}
            alt=""
            style={{
              left:
                Math.random() * (POS_MAX_VW - POS_MIN_VW) + POS_MIN_VW + "vw",
              animationDelay: Math.random() * DELAY_MAX_MS + "ms",
            }}
          />
        ))}
      </div>
    )
  }

  private setTimer(): void {
    // Remove DOM elements after animation ends.
    window.setTimeout(
      () =>
        this.setState({
          drawnId: this.props.element.get("executionId"),
        }),
      MAX_ANIMATION_DURATION_MS + DELAY_MAX_MS + 100
    )
  }
}

function getBalloonUrl(balloonsProto: ImmutableMap<string, any>): string {
  const type = balloonsProto.get("type")

  if (type === BalloonsProto.Type.DEFAULT) {
    if (Math.random() > BALLOON_PROB) {
      const rand = Math.ceil(Math.random() * (BALLOON_IMAGES.length - 1))
      return BALLOON_IMAGES[rand]
    } else {
      return BALLOON_IMAGES[BalloonsProto.Type.BALLOON]
    }
  }

  return BALLOON_IMAGES[type]
}

export default Balloons
