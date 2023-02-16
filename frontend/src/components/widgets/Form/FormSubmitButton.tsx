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

import React, { ReactElement, useEffect } from "react"
import { AlertTypeMessage, Button as ButtonProto } from "src/autogen/proto"
import UIButton, {
  ButtonTooltip,
  Kind,
  Size,
} from "src/components/shared/Button"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown/index"
import { X as CloseIcon } from "react-feather"
import {
  StyledModalCloseIconButton,
  StyledModalCloseButtonWrapper,
} from "src/components/widgets/Form/styled-components"
import AlertTypeOptions = AlertTypeMessage.AlertTypeOptions

export interface Props {
  disabled: boolean
  element: ButtonProto
  hasInProgressUpload: boolean
  isModalCloseButton?: boolean
  widgetMgr: WidgetStateManager
  width: number
}

export function FormSubmitButton(props: Props): ReactElement {
  const {
    disabled,
    element,
    widgetMgr,
    hasInProgressUpload,
    width,
    isModalCloseButton,
  } = props
  const { formId } = element
  const style = { width }
  const kind =
    element.type === "primary"
      ? Kind.PRIMARY_FORM_SUBMIT
      : Kind.SECONDARY_FORM_SUBMIT

  useEffect(() => {
    widgetMgr.incrementSubmitButtonCount(formId)
    return () => widgetMgr.decrementSubmitButtonCount(formId)
  }, [widgetMgr, formId])

  return (
    <div
      className="row-widget stButton"
      data-testid="stFormSubmitButton"
      style={style}
    >
      {isModalCloseButton &&
      element.alert &&
      element.alert?.value === AlertTypeOptions.NONE ? (
        <StyledModalCloseIconButton
          onClick={() => widgetMgr.submitForm(element)}
        >
          <CloseIcon className="icon" size={18} />
        </StyledModalCloseIconButton>
      ) : isModalCloseButton ? (
        <StyledModalCloseButtonWrapper>
          <ButtonTooltip help={element.help}>
            <UIButton
              kind={Kind.HEADER_BUTTON}
              size={Size.SMALL}
              fluidWidth={element.useContainerWidth || false}
              disabled={disabled || hasInProgressUpload}
              onClick={() => widgetMgr.submitForm(element)}
            >
              <StreamlitMarkdown
                source={"Ok"}
                allowHTML={false}
                isLabel
                isButton
              />
            </UIButton>
          </ButtonTooltip>
        </StyledModalCloseButtonWrapper>
      ) : (
        <ButtonTooltip help={element.help}>
          <UIButton
            kind={kind}
            size={Size.SMALL}
            fluidWidth={element.useContainerWidth || false}
            disabled={disabled || hasInProgressUpload}
            onClick={() => widgetMgr.submitForm(element)}
          >
            <StreamlitMarkdown
              source={element.label}
              allowHTML={false}
              isLabel
              isButton
            />
          </UIButton>
        </ButtonTooltip>
      )}
    </div>
  )
}
