import React, { ReactElement } from "react"
import { toHex } from "color2k"
import { CustomThemeConfig } from "autogen/proto"
import Button, { Kind } from "components/shared/Button"
import {
  StyledHeader,
  StyledThemeDesc,
  StyledThemeCreator,
  StyledThemeColorPicker,
  StyledButtonContainer,
} from "./styled-components"

export interface Props {
  label?: string
  themeInput: Partial<CustomThemeConfig>
  updateThemeInput: (themeInput: Partial<CustomThemeConfig>) => any
}

const themeBuilder: any = {
  primaryColor: {
    desc:
      "Used to style primary interface elements. Displayed most frequently across your app's screens and components.",
    title: "Primary color",
  },
  secondaryColor: {
    desc:
      "(Optional) Used to style secondary interface elements. It provides ways to accent and distinguish your app.",
    title: "Secondary color",
  },
  backgroundColor: {
    desc: "Background color for the main container.",
    title: "Background color",
  },
  secondaryBackgroundColor: {
    desc:
      "Used as the background for most widgets. Examples of widgets with this background are st.sidebar, st.text_input, st.date_input.",
    title: "Secondary background color",
  },
  textColor: {
    desc: "Font color for the page",
    title: "Text color",
  },
}

const ThemeCreator = ({
  themeInput,
  updateThemeInput,
  label,
}: Props): ReactElement => {
  const themeCreator = React.useRef<HTMLDivElement>(null)

  const { font, name, ...colors } = themeInput
  const onColorChange = (key: string, color: string): void => {
    updateThemeInput({
      ...themeInput,
      [key]: color,
    })
  }

  const config = `[theme]
primaryColor="${themeInput.primaryColor}"
secondaryColor="${themeInput.secondaryColor}"
backgroundColor="${themeInput.backgroundColor}"
secondaryBackgroundColor=${themeInput.secondaryBackgroundColor}
textColor="${themeInput.textColor}"
font="${themeInput.font}"
`

  const [isOpen, openCreator] = React.useState(false)

  const toggleCreatorUI = (): void => {
    openCreator(true)
  }

  React.useEffect(() => {
    if (isOpen && themeCreator.current) {
      themeCreator.current.scrollIntoView(true)
    }
  }, [isOpen])

  const copyConfig = (): void => {
    navigator.clipboard.writeText(config)
  }

  return (
    <div ref={themeCreator}>
      {isOpen ? (
        <>
          <StyledHeader>Create Custom Theme</StyledHeader>
          <StyledThemeCreator>
            {Object.entries(colors).map(([key, value]) => (
              <>
                <StyledThemeColorPicker
                  disabled={false}
                  value={toHex(value as string).toUpperCase()}
                  label={themeBuilder[key].title}
                  onChange={color => onColorChange(key, color)}
                  showValue
                />
                <StyledThemeDesc>{themeBuilder[key].desc}</StyledThemeDesc>
              </>
            ))}
          </StyledThemeCreator>

          <StyledButtonContainer>
            <Button onClick={copyConfig} kind={Kind.PRIMARY}>
              Copy Theme to Clipboard
            </Button>
          </StyledButtonContainer>
        </>
      ) : (
        <Button onClick={toggleCreatorUI} kind={Kind.LINK}>
          {label || "Edit theme"}
        </Button>
      )}
    </div>
  )
}

export default ThemeCreator
