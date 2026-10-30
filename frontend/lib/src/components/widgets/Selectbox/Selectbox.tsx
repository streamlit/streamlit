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

import { type FC, memo, useCallback, useEffect, useRef, useState } from "react"

import type { Selectbox as SelectboxProto } from "@streamlit/protobuf"
import { isNullOrEmptyString } from "@streamlit/utils"

import UISelectbox from "~lib/components/shared/Dropdown/Selectbox"
import { requiredFieldError } from "~lib/components/widgets/BaseWidget/requiredField"
import {
  useBasicWidgetState,
  type ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import {
  isInForm,
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
} from "~lib/util/utils"
import type { WidgetStateManager } from "~lib/WidgetStateManager"

export interface Props {
  disabled: boolean
  element: SelectboxProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

/**
 * The value specified by the user via the UI. If the user didn't touch this
 * widget's UI, the default value is used.
 */
type SelectboxValue = string | null

const getStateFromWidgetMgr = (
  widgetMgr: WidgetStateManager,
  element: SelectboxProto
): SelectboxValue | undefined => {
  return widgetMgr.getStringValue(element)
}

const getDefaultStateFromProto = (element: SelectboxProto): SelectboxValue => {
  if (element.options.length === 0 || isNullOrUndefined(element.default)) {
    return null
  }
  return element.options[element.default]
}

const getCurrStateFromProto = (element: SelectboxProto): SelectboxValue => {
  return element.rawValue ?? null
}

const updateWidgetMgrState = (
  element: SelectboxProto,
  widgetMgr: WidgetStateManager,
  valueWithSource: ValueWithSource<SelectboxValue>,
  fragmentId: string | undefined
): void => {
  widgetMgr.setStringValue(element.id, valueWithSource.value, {
    formId: element.formId,
    fragmentId,
    fromUser: valueWithSource.fromUser,
    // on_change="ignore" buffers the value without scheduling a rerun.
    // WidgetStateManager ignores triggerRerun inside forms (the form owns
    // commit timing).
    ...(element.ignoreRerun ? { triggerRerun: false } : {}),
  })
}

const Selectbox: FC<Props> = ({
  disabled,
  element,
  widgetMgr,
  fragmentId,
}) => {
  const {
    options,
    help,
    label,
    labelVisibility,
    placeholder,
    acceptNewOptions,
    filterMode,
    formId,
  } = element

  // Keep the query-param binding clearable whenever the default is empty, even
  // when `required` is set, so `?key=` still restores the empty default. The UI
  // never commits null for a required selectbox, so it never writes an empty
  // param.
  const queryParamBinding = !isNullOrEmptyString(element.queryParamKey)
    ? {
        paramKey: element.queryParamKey,
        valueType: "string_value" as const,
        clearable: isNullOrUndefined(element.default),
      }
    : undefined

  const [value, setValueWithSource] = useBasicWidgetState<
    SelectboxValue,
    SelectboxProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
    formClearBehavior: "resetValueOnly",
    queryParamBinding,
  })

  /**
   * Set by a failed form submit while the selectbox is required and empty.
   * The displayed error is derived from this flag, the current `required`
   * flag, and the current value.
   */
  const [hasRequiredError, setHasRequiredError] = useState(false)

  // Drop the stored flag once the error is hidden (a selection, a
  // session_state write, or `required` turned off). `required` is not part of
  // keyed widget identity, so the flag would otherwise reappear when
  // `required` turns back on or a programmatic write empties the field.
  const requiredError = requiredFieldError(
    element.required,
    hasRequiredError,
    isNullOrUndefined(value)
  )
  if (hasRequiredError && requiredError === null) {
    setHasRequiredError(false)
  }

  const onChange = useCallback(
    (valueArg: SelectboxValue) => {
      setValueWithSource({ value: valueArg, fromUser: true })
    },
    [setValueWithSource]
  )

  /**
   * Form submit validator: blocks the submit and shows the required error
   * while the selectbox is required and empty. Reads this render's `value`,
   * which is current because every submit runs in a later event than the
   * selection that set it.
   */
  const validateRequired = (): boolean => {
    if (element.required && isNullOrUndefined(value)) {
      setHasRequiredError(true)
      return false
    }
    return true
  }
  const formSubmitValidatorRef = useRef(validateRequired)
  formSubmitValidatorRef.current = validateRequired

  const inForm = isInForm({ formId })

  // Outside a form there is no empty commit to block (see `clearable`), so
  // only a form submit can show the required error.
  useEffect(() => {
    if (!inForm || !element.required) {
      return undefined
    }

    const validator = (): boolean => formSubmitValidatorRef.current()
    widgetMgr.addFormSubmitValidator(formId, element.id, validator)

    return () => {
      widgetMgr.removeFormSubmitValidator(formId, element.id)
    }
  }, [element.id, element.required, formId, inForm, widgetMgr])

  // The clear button and Escape are the only UI paths that commit null, so
  // they are enabled only when the default is empty and never when required.
  const clearable =
    isNullOrUndefined(element.default) && !disabled && !element.required

  return (
    <UISelectbox
      label={label}
      labelVisibility={labelVisibilityProtoValueToEnum(labelVisibility?.value)}
      options={options}
      disabled={disabled}
      onChange={onChange}
      value={value}
      help={help}
      placeholder={placeholder}
      clearable={clearable}
      acceptNewOptions={acceptNewOptions ?? false}
      filterMode={filterMode}
      required={element.required}
      error={requiredError}
    />
  )
}

export default memo(Selectbox)
