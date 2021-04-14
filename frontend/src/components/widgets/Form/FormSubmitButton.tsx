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

import React, { PureComponent, ReactNode } from "react"
import { Button as ButtonProto } from "src/autogen/proto"
import UIButton, { Kind, Size } from "src/components/shared/Button"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import { FormsManager } from "./FormsManager"

export interface Props {
  disabled: boolean
  element: ButtonProto
  hasInProgressUpload: boolean
  widgetMgr: WidgetStateManager
  formsMgr: FormsManager
  width: number
}

export class FormSubmitButton extends PureComponent<Props> {
  public componentDidMount = (): void => {
    this.props.formsMgr.incrementSubmitButtonCount(this.props.element.formId)
  }

  public componentWillUnmount = (): void => {
    this.props.formsMgr.decrementSubmitButtonCount(this.props.element.formId)
  }

  public componentDidUpdate = (prevProps: Props): void => {
    const prevFormId = prevProps.element.formId
    const newFormId = this.props.element.formId
    if (prevFormId !== newFormId) {
      this.props.formsMgr.decrementSubmitButtonCount(prevFormId)
      this.props.formsMgr.incrementSubmitButtonCount(newFormId)
    }
  }

  public render = (): ReactNode => {
    const { disabled, element, widgetMgr, hasInProgressUpload } = this.props

    const style = { width: this.props.width }

    return (
      <div
        className="row-widget stButton"
        data-testid="stFormSubmitButton"
        style={style}
      >
        <UIButton
          kind={Kind.FORM_SUBMIT}
          size={Size.SMALL}
          disabled={disabled || hasInProgressUpload}
          onClick={() => widgetMgr.submitForm(element)}
        >
          {element.label}
        </UIButton>
      </div>
    )
  }
}
