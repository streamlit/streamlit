import React, { ReactElement } from "react"
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
  widgetMgr: WidgetStateManager
  width: number
}

function Button(props: Props): ReactElement {
  const { disabled, element, widgetMgr, width } = props
  const style = { width }

  return (
    <div className="row-widget stButton" style={style}>
      <ButtonTooltip help={element.help}>
        <UIButton
          kind={Kind.PRIMARY}
          size={Size.SMALL}
          disabled={disabled}
          onClick={() => widgetMgr.setTriggerValue(element, { fromUi: true })}
        >
          {element.label}
        </UIButton>
      </ButtonTooltip>
    </div>
  )
}

export default Button
