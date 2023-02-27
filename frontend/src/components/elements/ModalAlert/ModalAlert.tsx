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
import { Alert, AlertWithTitle } from "./Alert"
import UIButton, { Kind, Size } from "src/components/shared/Button"
import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown/index"
import {
  Alert as AlertProto,
  ModalAlert as ModalAlertProto,
} from "src/autogen/proto"

import * as SharedModal from "src/components/shared/Modal"

export interface IModalAlertProps {
  element: ModalAlertProto
}
export interface IModalAlertState {
  isOpen: boolean
}

class ModalWithAlert extends React.Component<
  IModalAlertProps,
  IModalAlertState
> {
  state: IModalAlertState = {
    isOpen: true,
  }

  closeModal(): void {
    this.setState({ isOpen: false })
  }

  render(): ReactElement {
    const { element } = this.props
    const { isOpen } = this.state
    return (
      <SharedModal.default isOpen={isOpen} closeable={false}>
        {element.title ? (
          <AlertWithTitle
            isModal={true}
            title={element.title}
            icon={element.alert?.icon as string}
            body={element.alert?.body || ""}
            format={element.alert?.format as AlertProto.Format}
          />
        ) : (
          <Alert
            isModal={true}
            body={element.alert?.body || ""}
            icon={element.alert?.icon as string}
            format={element.alert?.format as AlertProto.Format}
          />
        )}
        {element.closeable && (
          <UIButton
            kind={Kind.MODAL_ALERT_BUTTON}
            onClick={this.closeModal.bind(this)}
            size={Size.SMALL}
            alertType={element.alert?.format}
          >
            OK
          </UIButton>
        )}
      </SharedModal.default>
    )
  }
}
class ModalWithoutAlert extends React.Component<
  IModalAlertProps,
  IModalAlertState
> {
  state: IModalAlertState = {
    isOpen: true,
  }

  closeModal(): void {
    this.setState({ isOpen: false })
  }

  render(): ReactElement {
    const { element } = this.props
    const { isOpen } = this.state
    return (
      <SharedModal.default isOpen={isOpen} closeable={false}>
        <SharedModal.ModalBody>
          <StreamlitMarkdown
            source={
              element.title
                ? `#### ${element.title}\n${element.alert?.body}`
                : element.alert?.body || ""
            }
            allowHTML={false}
            isModal={true}
          ></StreamlitMarkdown>
          {element.closeable && (
            <UIButton
              kind={Kind.MODAL_ALERT_BUTTON}
              onClick={this.closeModal.bind(this)}
              size={Size.SMALL}
            >
              OK
            </UIButton>
          )}
        </SharedModal.ModalBody>
      </SharedModal.default>
    )
  }
}

export const ModalAlertProxy = ({
  element,
}: IModalAlertProps): ReactElement => {
  return element.alert?.format ? (
    <ModalWithAlert element={element} />
  ) : (
    <ModalWithoutAlert element={element} />
  )
}
