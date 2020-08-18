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

import React, { ReactElement, ReactNode } from "react"

import { SCSS_VARS } from "autogen/scssVariables"
import { Notification, KIND } from "baseui/notification"

import "assets/css/write.scss"

export { KIND }
export type KindTypeT = KIND[keyof KIND]

function getAlertBorder(kind: KindTypeT): string {
  const borderStyle = "1px solid "

  switch (kind) {
    case KIND.info:
      return borderStyle + SCSS_VARS["$alert-info-border-color"]
    case KIND.positive:
      return borderStyle + SCSS_VARS["$alert-success-border-color"]
    case KIND.warning:
      return borderStyle + SCSS_VARS["$alert-warning-border-color"]
    case KIND.negative:
      return borderStyle + SCSS_VARS["$alert-danger-border-color"]
    default:
      throw new Error(`Unexpected alert type: ${kind}`)
  }
}

export interface AlertContainerProps {
  width?: number
  kind: KindTypeT
  children: ReactNode
}

/**
 * Functional element representing error/warning/info/success boxes
 * which may be formatted in Markdown.
 */
export default function AlertContainer({
  kind,
  width,
  children,
}: AlertContainerProps): ReactElement {
  return (
    <Notification
      kind={kind}
      overrides={{
        Body: {
          style: {
            marginTop: 0,
            marginBottom: 0,
            width,
            border: getAlertBorder(kind),
          },
        },
      }}
    >
      {children}
    </Notification>
  )
}
