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
import { Map as ImmutableMap } from "immutable"

/*
 * IMPORTANT: If you change the asset imports below, make sure they still work if Streamlit is
 * served from a subpath.
 */
import Balloon0 from "assets/img/balloons/balloon-0.png"
import Balloon1 from "assets/img/balloons/balloon-1.png"
import Balloon2 from "assets/img/balloons/balloon-2.png"
import Balloon3 from "assets/img/balloons/balloon-3.png"
import Balloon4 from "assets/img/balloons/balloon-4.png"
import Balloon5 from "assets/img/balloons/balloon-5.png"

import "./Balloons.scss"

const NUM_BALLOONS = 30
const POS_MIN_VW = 20
const POS_MAX_VW = 80
const DELAY_MAX_MS = 1000

// Prebuild array with NUM_BALLOONS dummy elements.
const BALLOON_PLACEHOLDERS = Array.from({ length: NUM_BALLOONS })

const BALLOON_IMAGES: string[] = [
  Balloon0,
  Balloon1,
  Balloon2,
  Balloon3,
  Balloon4,
  Balloon5,
]

const BALLOON_TYPES = BALLOON_IMAGES.length

export interface Props {
  width: number
  element: ImmutableMap<string, any>
}

export function Balloons(props: Props): React.ReactNode {
  const reportId = props.reportId

  return (
    <div className="balloons">
      {BALLOON_PLACEHOLDERS.map((_, i) => drawBalloon(reportId, i))}
    </div>
  )
}

function drawBalloon(reportId: number, i: number) {
  const randNum = Math.floor(Math.random() * BALLOON_TYPES)

  return (
    <img
      src={BALLOON_IMAGES[randNum]}
      className="balloon"
      key={reportId + i}
      alt=""
      style={{
        left: `${Math.random() * (POS_MAX_VW - POS_MIN_VW) + POS_MIN_VW}vw`,
        animationDelay: `${Math.random() * DELAY_MAX_MS}ms`,
      }}
    />
  )
}

export default Balloons
