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

import { Alert as AlertProto } from "src/autogen/proto"
import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown"
import { EmojiIcon } from "src/components/shared/Icon"
import AlertContainer from "src/components/shared/AlertContainer"
import {
  StyledIconAlertContent,
  StyledIconAlertContentWithTitle,
} from "./styled-components"
import { getAlertKind } from "src/components/elements/Alert/Alert"

export interface AlertProps {
  body: string
  isModal: boolean
  icon?: string
  format?: AlertProto.Format
}

export function Alert({
  body,
  isModal,
  icon,
  format,
}: AlertProps): ReactElement {
  return (
    <div className="stAlert">
      <AlertContainer
        width={"100%"}
        kind={getAlertKind(format as AlertProto.Format)}
      >
        <StyledIconAlertContent>
          {icon && <EmojiIcon size="lg">{icon}</EmojiIcon>}
          <StreamlitMarkdown
            isModal={isModal}
            source={body}
            allowHTML={false}
          />
        </StyledIconAlertContent>
      </AlertContainer>
    </div>
  )
}

export interface AlertWithTitleProps {
  body: string
  title: string
  isModal: boolean
  icon?: string
  format?: AlertProto.Format
}

export function AlertWithTitle({
  body,
  title,
  isModal,
  icon,
  format,
}: AlertWithTitleProps): ReactElement {
  return (
    <div className="stAlert">
      <AlertContainer
        width={"100%"}
        kind={getAlertKind(format as AlertProto.Format)}
      >
        <StyledIconAlertContentWithTitle>
          {icon && <EmojiIcon size="lg">{icon}</EmojiIcon>}
          <h4>{title}</h4>
        </StyledIconAlertContentWithTitle>
        <StyledIconAlertContent>
          <StreamlitMarkdown
            isModal={isModal}
            source={body}
            allowHTML={false}
          />
        </StyledIconAlertContent>
      </AlertContainer>
    </div>
  )
}
