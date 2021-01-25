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

import React, { ReactElement } from "react"
import ReactJson from "react-json-view"
import JSON5 from "json5"
import { Json as JsonProto } from "autogen/proto"
import { useTheme } from "emotion-theming"
import { Theme } from "theme"

export interface JsonProps {
  width: number
  element: JsonProto
}

/**
 * Functional element representing JSON structured text.
 */
export default function Json({ width, element }: JsonProps): ReactElement {
  const styleProp = { width }
  const theme: Theme = useTheme()

  let bodyObject
  try {
    bodyObject = JSON.parse(element.body)
  } catch (e) {
    try {
      bodyObject = JSON5.parse(element.body)
    } catch (json5Error) {
      // If content fails to parse as Json, rebuild the error message
      // to show where the problem occurred.
      const pos = parseInt(e.message.replace(/[^0-9]/g, ""), 10)
      e.message += `\n${element.body.substr(0, pos + 1)} ← here`
      throw e
    }
  }
  return (
    <div data-testid="stJson" style={styleProp}>
      <ReactJson
        src={bodyObject}
        displayDataTypes={false}
        displayObjectSize={false}
        name={false}
        style={{
          fontFamily: theme.fonts.mono,
          fontSize: theme.fontSizes.smDefault,
        }}
      />
    </div>
  )
}
