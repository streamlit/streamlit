/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { memo, ReactElement, ReactNode, useEffect } from "react"

import { WidgetStateManager } from "~lib/WidgetStateManager"

import { StyledForm } from "./styled-components"

export interface Props {
  formId: string
  clearOnSubmit: boolean
  enterToSubmit: boolean
  children?: ReactNode
  widgetMgr: WidgetStateManager
  border: boolean
  // TODO(lawilby): This prop drill-down can be removed once
  // we are using a portal to render the toolbars. But we want to
  // do a patch to reduce the impact on existing usages of st.form.
  overflow?: React.CSSProperties["overflow"]
}

function Form(props: Props): ReactElement {
  const {
    formId,
    widgetMgr,
    children,
    clearOnSubmit,
    enterToSubmit,
    border,
    overflow,
  } = props

  // Tell WidgetStateManager if this form is `clearOnSubmit` and `enterToSubmit`
  useEffect(() => {
    widgetMgr.setFormSubmitBehaviors(formId, clearOnSubmit, enterToSubmit)
  }, [widgetMgr, formId, clearOnSubmit, enterToSubmit])

  return (
    <StyledForm
      className="stForm"
      data-testid="stForm"
      border={border}
      overflow={overflow}
    >
      {children}
    </StyledForm>
  )
}

export default memo(Form)
