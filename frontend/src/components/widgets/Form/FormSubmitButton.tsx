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

import { Button as ButtonProto } from "src/autogen/proto"
import UIButton, { Kind, Size } from "src/components/shared/Button"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import React, { ReactElement } from "react"

export interface Props {
  disabled: boolean
  element: ButtonProto
  hasPendingChanges: boolean
  hasInProgressUpload: boolean
  widgetMgr: WidgetStateManager
  width: number
}

export default function FormSubmitButton(props: Props): ReactElement {
  const style = { width: props.width }

  return (
    <div
      className="row-widget stButton"
      data-testid="stFormSubmitButton"
      style={style}
    >
      <UIButton
        kind={
          props.hasPendingChanges
            ? Kind.FORM_SUBMIT_HAS_PENDING_CHANGES
            : Kind.FORM_SUBMIT_NO_PENDING_CHANGES
        }
        size={Size.SMALL}
        disabled={props.disabled || props.hasInProgressUpload}
        onClick={() => props.widgetMgr.submitForm(props.element)}
      >
        {props.element.label}
      </UIButton>
    </div>
  )
}
