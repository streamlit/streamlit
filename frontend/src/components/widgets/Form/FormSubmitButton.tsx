import React, { ReactElement, useEffect } from "react"
import { Button as ButtonProto } from "src/autogen/proto"
import UIButton, {
  ButtonTooltip,
  Kind,
  Size,
} from "src/components/shared/Button"
import { WidgetStateManager } from "src/lib/WidgetStateManager"

export interface Props {
  disabled: boolean
  element: ButtonProto
  hasInProgressUpload: boolean
  widgetMgr: WidgetStateManager
  width: number
}

export function FormSubmitButton(props: Props): ReactElement {
  const { disabled, element, widgetMgr, hasInProgressUpload, width } = props
  const { formId } = element
  const style = { width }

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
      <ButtonTooltip help={element.help}>
        <UIButton
          kind={Kind.FORM_SUBMIT}
          size={Size.SMALL}
          disabled={disabled || hasInProgressUpload}
          onClick={() => widgetMgr.submitForm(element)}
        >
          {element.label}
        </UIButton>
      </ButtonTooltip>
    </div>
  )
}
