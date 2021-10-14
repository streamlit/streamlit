/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

import React, { ReactElement, ReactNode, useEffect, useState } from "react"
import Alert from "src/components/elements/Alert"
import { Kind } from "src/components/shared/AlertContainer"
import { ReportRunState } from "src/lib/ReportRunState"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import { StyledErrorContainer, StyledForm } from "./styled-components"

export interface Props {
  formId: string
  clearOnSubmit: boolean
  width: number
  hasSubmitButton: boolean
  reportRunState: ReportRunState
  children?: ReactNode
  widgetMgr: WidgetStateManager
}

export const MISSING_SUBMIT_BUTTON_WARNING =
  "**Missing Submit Button**" +
  "\n\nThis form has no submit button, which means that user interactions will " +
  "never be sent to your Streamlit app." +
  "\n\nTo create a submit button, use the `st.form_submit_button()` function." +
  "\n\nFor more information, refer to the " +
  "[documentation for forms](https://docs.streamlit.io/library/api-reference/control-flow/st.form)."

export function Form(props: Props): ReactElement {
  const {
    formId,
    widgetMgr,
    hasSubmitButton,
    children,
    width,
    reportRunState,
    clearOnSubmit,
  } = props

  // Tell WidgetStateManager if this form is `clearOnSubmit` so that it can
  // do the right thing when the form is submitted.
  useEffect(() => {
    widgetMgr.setFormClearOnSubmit(formId, clearOnSubmit)
  }, [widgetMgr, formId, clearOnSubmit])

  // Determine if we need to show the "missing submit button" warning.
  // If we have a submit button, we don't show the warning, of course.
  // If we *don't* have a submit button, then we only mutate the showWarning
  // flag when our reportRunState is NOT_RUNNING. (If the report is still
  // running, there might be an incoming SubmitButton delta that we just
  // haven't seen yet.)
  const [showWarning, setShowWarning] = useState(false)

  if (hasSubmitButton && showWarning) {
    setShowWarning(false)
  } else if (
    !hasSubmitButton &&
    !showWarning &&
    reportRunState === ReportRunState.NOT_RUNNING
  ) {
    setShowWarning(true)
  }

  let submitWarning: ReactElement | undefined
  if (showWarning) {
    submitWarning = (
      <StyledErrorContainer>
        <Alert
          body={MISSING_SUBMIT_BUTTON_WARNING}
          kind={Kind.ERROR}
          width={width}
        />
      </StyledErrorContainer>
    )
  }

  return (
    <StyledForm data-testid="stForm" width={width}>
      {children}
      {submitWarning}
    </StyledForm>
  )
}
