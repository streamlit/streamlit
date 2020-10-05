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

import { Alert as AlertProto, IAlert } from "autogen/proto"
import AlertContainer, { Kind } from "components/shared/AlertContainer"
import { StreamlitMarkdown } from "components/shared/StreamlitMarkdown"
import { requireNonNull } from "lib/utils"
import React, { ReactElement } from "react"

export function getAlertKind(format: AlertProto.Format): Kind {
  switch (format) {
    case AlertProto.Format.ERROR:
      return Kind.ERROR
    case AlertProto.Format.INFO:
      return Kind.INFO
    case AlertProto.Format.SUCCESS:
      return Kind.SUCCESS
    case AlertProto.Format.WARNING:
      return Kind.WARNING
    default:
      throw new Error(`Unexpected alert type: ${format}`)
  }
}

export interface AlertProps {
  width: number
  element: IAlert
}

/**
 * Functional element representing error/warning/info/success boxes
 * which may be formatted in Markdown.
 */
export default function Alert({ element, width }: AlertProps): ReactElement {
  const body = requireNonNull(element.body)
  const format = requireNonNull(element.format)

  return (
    <div className="stAlert">
      <AlertContainer width={width} kind={getAlertKind(format)}>
        <div className="markdown-text-container">
          <StreamlitMarkdown source={body} allowHTML={false} />
        </div>
      </AlertContainer>
    </div>
  )
}
