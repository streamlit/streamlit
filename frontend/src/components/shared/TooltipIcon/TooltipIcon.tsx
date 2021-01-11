import React, { ReactElement } from "react"
import Tooltip, { Placement } from "components/shared/Tooltip"
import { HelpCircle as HelpCircleIcon } from "react-feather"
import StreamlitMarkdown from "components/shared/StreamlitMarkdown"

export interface TooltipIconProps {
  placement?: Placement
  iconSize?: string
  content: string
}

function TooltipIcon({
  placement = Placement.AUTO,
  iconSize = "16",
  content,
}: TooltipIconProps): ReactElement {
  return (
    <Tooltip
      content={<StreamlitMarkdown source={content} allowHTML />}
      placement={placement}
    >
      <HelpCircleIcon size={iconSize} />
    </Tooltip>
  )
}

export { Placement }
export default TooltipIcon
