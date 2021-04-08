/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

import React, { ReactElement, memo } from "react"
import range from "lodash/range"

/*
 * IMPORTANT: If you change the asset imports below, make sure they still work if Streamlit is
 * served from a subpath.
 */
import Balloon0 from "src/assets/img/balloons/balloon-0.png"
import Balloon1 from "src/assets/img/balloons/balloon-1.png"
import Balloon2 from "src/assets/img/balloons/balloon-2.png"
import Balloon3 from "src/assets/img/balloons/balloon-3.png"
import Balloon4 from "src/assets/img/balloons/balloon-4.png"
import Balloon5 from "src/assets/img/balloons/balloon-5.png"

import { StyledBalloon } from "./styled-components"

export const NUM_BALLOONS = 30

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
  reportId: string
}

function Balloons({ reportId }: Props): ReactElement {
  // Keys should be unique each time, so React replaces the images in the DOM and their animations
  // actually rerun.
  return (
    <div className="balloons stHidden">
      {range(NUM_BALLOONS).map(i => {
        const randNum = Math.floor(Math.random() * BALLOON_TYPES)

        return (
          <StyledBalloon key={reportId + i} src={BALLOON_IMAGES[randNum]} />
        )
      })}
    </div>
  )
}

export default memo(Balloons)
