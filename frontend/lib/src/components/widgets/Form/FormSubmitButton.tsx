/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { Button as ButtonProto } from "@streamlit/protobuf"

import { FormsContext } from "~lib/components/core/FormsContext"
import { Box } from "~lib/components/shared/Base/styled-components"
import BaseButton, {
  BaseButtonKind,
  BaseButtonSize,
  BaseButtonTooltip,
  DynamicButtonLabel,
} from "~lib/components/shared/BaseButton"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { WidgetStateManager } from "~lib/WidgetStateManager"

export interface Props {
  disabled: boolean
  element: ButtonProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

export function FormSubmitButton(props: Props): ReactElement {
  const { disabled, element, widgetMgr, fragmentId } = props
  const { formId } = element

  const { formsData } = useRequiredContext(FormsContext)
  const hasInProgressUpload = formsData.formsWithUploads.has(formId)

  let kind = BaseButtonKind.SECONDARY_FORM_SUBMIT
  if (element.type === "primary") {
    kind = BaseButtonKind.PRIMARY_FORM_SUBMIT
  } else if (element.type === "tertiary") {
    kind = BaseButtonKind.TERTIARY_FORM_SUBMIT
  }

  useEffect(() => {
    widgetMgr.addSubmitButton(formId, element)
    return () => widgetMgr.removeSubmitButton(formId, element)
  }, [widgetMgr, formId, element])

  return (
    <Box className="stFormSubmitButton" data-testid="stFormSubmitButton">
      <BaseButtonTooltip help={element.help} containerWidth={true}>
        <BaseButton
          kind={kind}
          size={BaseButtonSize.SMALL}
          containerWidth={true}
          disabled={disabled || hasInProgressUpload}
          onClick={() => {
            widgetMgr.submitForm(element.formId, fragmentId, element)
          }}
        >
          <DynamicButtonLabel icon={element.icon} label={element.label} />
        </BaseButton>
      </BaseButtonTooltip>
    </Box>
  )
}
