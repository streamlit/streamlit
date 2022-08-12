import React, { ReactElement } from "react"
import { useTheme } from "@emotion/react"
import { Theme, isPresetTheme } from "src/theme"
import { Spinner as SpinnerProto } from "src/autogen/proto"
import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown"
import AppContext from "src/components/core/AppContext"
import {
  StyledSpinnerContainer,
  ThemedStyledSpinner,
} from "./styled-components"

export interface SpinnerProps {
  width: number
  element: SpinnerProto
}

function Spinner({ width, element }: SpinnerProps): ReactElement {
  const theme: Theme = useTheme()
  const { activeTheme } = React.useContext(AppContext)
  const usingCustomTheme = !isPresetTheme(activeTheme)
  const styleProp = { width }

  return (
    <div className="stSpinner" style={styleProp}>
      <StyledSpinnerContainer>
        <ThemedStyledSpinner
          $size={theme.iconSizes.twoXL}
          $usingCustomTheme={usingCustomTheme}
        />
        <StreamlitMarkdown source={element.text} allowHTML={false} />
      </StyledSpinnerContainer>
    </div>
  )
}

export default Spinner
