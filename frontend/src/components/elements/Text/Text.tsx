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

import "assets/css/write.scss"
import { IText } from "autogen/proto"
import classNames from "classnames"
import React, { ReactElement } from "react"

export interface TextProps {
  width: number
  element: IText
}

/**
 * Functional element representing preformatted (plain) text.
 */
export default function Text({ width, element }: TextProps): ReactElement {
  const styleProp = { width }

  return (
    <div className={classNames("fixed-width", "stText")} style={styleProp}>
      {element.body}
    </div>
  )
}
