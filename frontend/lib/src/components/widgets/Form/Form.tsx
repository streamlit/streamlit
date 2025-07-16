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

import React, {
  memo,
  ReactElement,
  ReactNode,
  useEffect,
  useState,
} from "react"

import AlertElement from "~lib/components/elements/AlertElement"
import { Kind } from "~lib/components/shared/AlertContainer"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { StyledErrorContainer, StyledForm } from "./styled-components"

export interface Props {
  formId: string
  clearOnSubmit: boolean
  enterToSubmit: boolean
  hasSubmitButton: boolean
  scriptNotRunning: boolean
  children?: ReactNode
  widgetMgr: WidgetStateManager
  border: boolean
  // TODO(lawilby): This prop drill-down can be removed once
  // we are using a portal to render the toolbars. But we want to
  // do a patch to reduce the impact on existing usages of st.form.
  overflow?: React.CSSProperties["overflow"]
}

export const MISSING_SUBMIT_BUTTON_WARNING =
  "**Missing Submit Button**" +
  "\n\nThis form has no submit button, which means that user interactions will " +
  "never be sent to your Streamlit app." +
  "\n\nTo create a submit button, use the `st.form_submit_button()` function." +
  "\n\nFor more information, refer to the " +
  "[documentation for forms](https://docs.streamlit.io/develop/api-reference/execution-flow/st.form)."

function Form(props: Props): ReactElement {
  const {
    formId,
    widgetMgr,
    hasSubmitButton,
    children,
    scriptNotRunning,
    clearOnSubmit,
    enterToSubmit,
    border,
    overflow,
  } = props

  // Tell WidgetStateManager if this form is `clearOnSubmit` and `enterToSubmit`
  useEffect(() => {
    widgetMgr.setFormSubmitBehaviors(formId, clearOnSubmit, enterToSubmit)
  }, [widgetMgr, formId, clearOnSubmit, enterToSubmit])

  // Determine if we need to show the "missing submit button" warning.
  // If we have a submit button, we don't show the warning, of course.
  // If we *don't* have a submit button, then we only mutate the showWarning
  // flag when our scriptRunState is NOT_RUNNING. (If the script is still
  // running, there might be an incoming SubmitButton delta that we just
  // haven't seen yet.)
  const [showWarning, setShowWarning] = useState(false)

  if (hasSubmitButton && showWarning) {
    setShowWarning(false)
  } else if (!hasSubmitButton && !showWarning && scriptNotRunning) {
    setShowWarning(true)
  }

  let submitWarning: ReactElement | undefined
  if (showWarning) {
    submitWarning = (
      <StyledErrorContainer>
        <AlertElement body={MISSING_SUBMIT_BUTTON_WARNING} kind={Kind.ERROR} />
      </StyledErrorContainer>
    )
  }

  return (
    <StyledForm
      className="stForm"
      data-testid="stForm"
      border={border}
      overflow={overflow}
    >
      {children}
      {submitWarning}
    </StyledForm>
  )
}

export default memo(Form)
