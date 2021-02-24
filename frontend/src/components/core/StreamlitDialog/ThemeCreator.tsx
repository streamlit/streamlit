import React, { ReactElement } from "react"
import { toHex } from "color2k"
import humanizeString from "humanize-string"
import { CustomThemeConfig } from "autogen/proto"
import PageLayoutContext from "components/core/PageLayoutContext"
import Button, { Kind } from "components/shared/Button"
import UISelectbox from "components/shared/Dropdown"
import { createTheme, ThemeConfig, toThemeInput } from "theme"
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
  hasCustomTheme: boolean
}

interface ThemeOptionBuilder {
  desc: string
  title: string
  component: any
  options?: any[]
  getValue: (value: string, config: ThemeOptionBuilder) => any
}

const valueToColor = (value: string, config: ThemeOptionBuilder): string =>
  toHex(value).toUpperCase()

const displayFontOption = (
  font: CustomThemeConfig.FontFamily | string
): string =>
  // @ts-ignore
  humanizeString(CustomThemeConfig.FontFamily[font])

const themeBuilder: Record<string, ThemeOptionBuilder> = {
  primaryColor: {
    desc:
      "Used to style primary interface elements. Displayed most frequently across your app's screens and components.",
    title: "Primary color",
    component: StyledThemeColorPicker,
    getValue: valueToColor,
  },
  secondaryColor: {
    desc:
      "(Optional) Used to style secondary interface elements. It provides ways to accent and distinguish your app.",
    title: "Secondary color",
    component: StyledThemeColorPicker,
    getValue: valueToColor,
  },
  backgroundColor: {
    desc: "Background color for the main container.",
    title: "Background color",
    component: StyledThemeColorPicker,
    getValue: valueToColor,
  },
  secondaryBackgroundColor: {
    desc:
      "Used as the background for most widgets. Examples of widgets with this background are st.sidebar, st.text_input, st.date_input.",
    title: "Secondary background color",
    component: StyledThemeColorPicker,
    getValue: valueToColor,
  },
  textColor: {
    desc: "Font color for the page",
    title: "Text color",
    component: StyledThemeColorPicker,
    getValue: valueToColor,
  },
  font: {
    desc:
      "Font family (serif | sans-serif | monospace) for the page. Will not impact the code areas.",
    title: "Font family",
    options: Object.keys(CustomThemeConfig.FontFamily).map(font =>
      humanizeString(font)
    ),
    getValue: (value: string, config: ThemeOptionBuilder): number =>
      (config.options &&
        config.options.findIndex(
          (font: string) => font === displayFontOption(value)
        )) ||
      0,
    component: UISelectbox,
  },
}

const ThemeCreator = ({ hasCustomTheme }: Props): ReactElement => {
  const themeCreator = React.useRef<HTMLDivElement>(null)
  const {
    availableThemes,
    activeTheme,
    addThemes,
    setTheme,
  } = React.useContext(PageLayoutContext)

  const themeInput = {
    ...toThemeInput(activeTheme.emotion),
    name: hasCustomTheme ? activeTheme.name : "Custom theme",
  }

  const updateTheme = (customTheme: ThemeConfig): void => {
    addThemes([customTheme])
    setTheme(customTheme)
  }

  const onThemeOptionChange = (key: string, newVal: string): void => {
    const customTheme = createTheme({
      ...themeInput,
      [key]: newVal,
    })
    updateTheme(customTheme)
  }

  const config = `[theme]
primaryColor="${themeInput.primaryColor}"
secondaryColor="${themeInput.secondaryColor}"
backgroundColor="${themeInput.backgroundColor}"
secondaryBackgroundColor="${themeInput.secondaryBackgroundColor}"
textColor="${themeInput.textColor}"
font="${displayFontOption(
    themeInput.font || CustomThemeConfig.FontFamily.SANS_SERIF
  ).toLowerCase()}"
`

  const [isOpen, openCreator] = React.useState(false)

  const toggleCreatorUI = (): void => {
    openCreator(true)
    updateTheme({
      ...activeTheme,
      name: hasCustomTheme
        ? availableThemes[availableThemes.length - 1].name
        : "Custom Theme",
    })
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
    // Props that vary based on component type
    const variableProps = {
      options: themeOptionConfig.options || undefined,
      showValue: isColor,
      value: themeOptionConfig.getValue(value, themeOptionConfig),
    }
    return (
      <React.Fragment key={themeOption}>
        <themeOptionConfig.component
          disabled={false}
          label={themeOptionConfig.title}
          onChange={(newVal: string) =>
            onThemeOptionChange(themeOption, newVal)
          }
          {...variableProps}
        />
        <StyledThemeDesc>{themeOptionConfig.desc}</StyledThemeDesc>
      </React.Fragment>
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
          {hasCustomTheme
            ? "Edit Existing Custom Theme"
            : "Create a new Custom Theme"}
        </Button>
      )}
    </StyledThemeCreatorWrapper>
  )
}

export default ThemeCreator
