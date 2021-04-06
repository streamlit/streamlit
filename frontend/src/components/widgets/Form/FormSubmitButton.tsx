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

import UIButton, { Kind, Size } from "components/shared/Button"
import { WidgetStateManager } from "lib/WidgetStateManager"
import React, { ReactElement } from "react"
import { Button as ButtonProto } from "autogen/proto"

export interface Props {
  disabled: boolean
  element: ButtonProto
  widgetMgr: WidgetStateManager
  width: number
}

export default function FormSubmitButton(props: Props): ReactElement {
  const { element, disabled, widgetMgr } = props

  return (
    <div className="row-widget stButton">
      <UIButton
        kind={Kind.FORM_SUBMIT}
        size={Size.SMALL}
        disabled={disabled}
        onClick={() => widgetMgr.submitForm(element.formId)}
      >
        {element.label}
      </UIButton>
    </div>
  )
}
