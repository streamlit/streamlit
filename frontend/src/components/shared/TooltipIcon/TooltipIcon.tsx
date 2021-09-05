import React, { ReactElement, ReactNode } from "react"
import Tooltip, { Placement } from "src/components/shared/Tooltip"
import { HelpCircle as HelpCircleIcon } from "react-feather"
import StreamlitMarkdown, {
  StreamlitMarkdownProps,
} from "src/components/shared/StreamlitMarkdown"
import { useTheme } from "emotion-theming"
import { Theme } from "src/theme"
import { StyledTooltipIconWrapper } from "./styled-components"

export interface TooltipIconProps {
  placement?: Placement
  iconSize?: string
  content: string
  children?: ReactNode
  markdownProps?: StreamlitMarkdownProps
}

function TooltipIcon({
  placement = Placement.AUTO,
  iconSize = "16",
  content,
  children,
  markdownProps,
}: TooltipIconProps): ReactElement {
  const theme: Theme = useTheme()
  return (
    <StyledTooltipIconWrapper className="stTooltipIcon">
      <Tooltip
        content={
          <StreamlitMarkdown
            style={{ fontSize: theme.fontSizes.sm }}
            source={content}
            allowHTML={false}
            {...(markdownProps || {})}
          />
        }
        placement={placement}
        inline
      >
        {children || <HelpCircleIcon className="icon" size={iconSize} />}
      </Tooltip>
    </StyledTooltipIconWrapper>
  )
}

export default TooltipIcon
