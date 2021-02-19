import React, { ReactElement } from "react"
import { toHex } from "color2k"
import humanizeString from "humanize-string"
import { CustomThemeConfig } from "autogen/proto"
import Button, { Kind } from "components/shared/Button"
import UISelectbox from "components/shared/Dropdown"
import { fonts } from "theme/primitives/typography"
import {
  StyledButtonContainer,
  StyledHeader,
  StyledSmall,
  StyledThemeColorPicker,
  StyledThemeCreator,
  StyledThemeCreatorWrapper,
  StyledThemeDesc,
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
    component: StyledThemeColorPicker,
  },
  secondaryColor: {
    desc:
      "(Optional) Used to style secondary interface elements. It provides ways to accent and distinguish your app.",
    title: "Secondary color",
    component: StyledThemeColorPicker,
  },
  backgroundColor: {
    desc: "Background color for the main container.",
    title: "Background color",
    component: StyledThemeColorPicker,
  },
  secondaryBackgroundColor: {
    desc:
      "Used as the background for most widgets. Examples of widgets with this background are st.sidebar, st.text_input, st.date_input.",
    title: "Secondary background color",
    component: StyledThemeColorPicker,
  },
  textColor: {
    desc: "Font color for the page",
    title: "Text color",
    component: StyledThemeColorPicker,
  },
  font: {
    desc:
      "Font family (serif | sans-serif | monospace) for the page. Will not impact the code areas.",
    title: "Font family",
    options: Object.keys(CustomThemeConfig.FontFamily).map(font =>
      humanizeString(font)
    ),
    component: UISelectbox,
  },
}

const ThemeCreator = ({
  themeInput,
  updateThemeInput,
  label,
}: Props): ReactElement => {
  const themeCreator = React.useRef<HTMLDivElement>(null)
  const onThemeOptionChange = (key: string, newVal: string): void => {
    updateThemeInput({
      ...themeInput,
      [key]: newVal,
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

  const renderThemeOption = (
    themeOption: string,
    value: string
  ): ReactElement | null => {
    const themeOptionConfig = themeBuilder[themeOption]
    if (themeOptionConfig === undefined) return null

    const isColor = themeOptionConfig.component === StyledThemeColorPicker
    const optionalProps = {
      options: themeOptionConfig.options || undefined,
      showValue: isColor,
      value: isColor
        ? toHex(value).toUpperCase()
        : themeOptionConfig.options.findIndex((font: string) =>
            humanizeString(
              Object.keys(fonts).find((key: string) => fonts[key] === font) ||
                ""
            )
          ),
    }
    return (
      <>
        <themeOptionConfig.component
          disabled={false}
          label={themeOptionConfig.title}
          onChange={(newVal: string) =>
            onThemeOptionChange(themeOption, newVal)
          }
          {...optionalProps}
        />
        <StyledThemeDesc>{themeOptionConfig.desc}</StyledThemeDesc>
      </>
    )
  }
  return (
    <StyledThemeCreatorWrapper ref={themeCreator}>
      {isOpen ? (
        <>
          <StyledHeader>Create Custom Theme</StyledHeader>
          <StyledThemeCreator>
            {Object.entries(themeInput).map(([themeOption, value]) =>
              renderThemeOption(themeOption, value as string)
            )}
          </StyledThemeCreator>

          <StyledButtonContainer>
            <Button onClick={copyConfig} kind={Kind.PRIMARY}>
              Copy Theme to Clipboard
            </Button>
            <StyledSmall>Copy TOML formatted config to clipboard</StyledSmall>
          </StyledButtonContainer>
        </>
      ) : (
        <Button onClick={toggleCreatorUI} kind={Kind.LINK}>
          {label || "Edit theme"}
        </Button>
      )}
    </StyledThemeCreatorWrapper>
  )
}

export default ThemeCreator
