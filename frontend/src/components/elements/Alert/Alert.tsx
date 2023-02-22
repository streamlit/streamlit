/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement } from "react"

import {
  Alert as AlertProto,
  AlertTypeMessage as AlertTypeMessageProto,
} from "src/autogen/proto"
import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown"
import { EmojiIcon } from "src/components/shared/Icon"
import AlertContainer, { Kind } from "src/components/shared/AlertContainer"
import { StyledIconAlertContent } from "./styled-components"

export function getAlertKind(
  format: AlertProto.Format | AlertTypeMessageProto.AlertTypeOptions
): Kind {
  switch (format) {
    case AlertProto.Format.ERROR:
    case AlertTypeMessageProto.AlertTypeOptions.ERROR:
      return Kind.ERROR
    case AlertProto.Format.INFO:
    case AlertTypeMessageProto.AlertTypeOptions.INFO:
      return Kind.INFO
    case AlertProto.Format.SUCCESS:
    case AlertTypeMessageProto.AlertTypeOptions.SUCCESS:
      return Kind.SUCCESS
    case AlertProto.Format.WARNING:
    case AlertTypeMessageProto.AlertTypeOptions.WARNING:
      return Kind.WARNING
    default:
      throw new Error(`Unexpected alert type: ${format}`)
  }
}

export interface AlertProps {
  body: string
  icon?: string
  kind: Kind
  width: number
  title?: string | null
  inModal?: boolean | null
}

/**
 * Display an (error|warning|info|success) box with a Markdown-formatted body.
 */
export default function Alert({
  icon,
  body,
  kind,
  width,
  inModal,
  title,
}: AlertProps): ReactElement {
  const hasTitleInModal = Boolean(title && inModal)
  return (
    <div className="stAlert">
      <AlertContainer width={width} kind={kind} inModal={inModal}>
        {hasTitleInModal && (
          <StyledIconAlertContent inModal={hasTitleInModal}>
            {icon && <EmojiIcon size="lg">{icon}</EmojiIcon>}
            <h4>{title}</h4>
          </StyledIconAlertContent>
        )}
        <StyledIconAlertContent>
          {!hasTitleInModal && icon && <EmojiIcon size="lg">{icon}</EmojiIcon>}
          <StreamlitMarkdown source={body || ""} allowHTML={false} />
        </StyledIconAlertContent>
      </AlertContainer>
    </div>
  )
}
