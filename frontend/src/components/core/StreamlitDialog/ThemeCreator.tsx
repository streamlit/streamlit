import React, { ReactElement } from "react"
import { toHex } from "color2k"
import humanizeString from "humanize-string"
import { Check } from "@emotion-icons/material-outlined"
import { CustomThemeConfig } from "autogen/proto"
import PageLayoutContext from "components/core/PageLayoutContext"
import Button, { Kind } from "components/shared/Button"
import ColorPicker from "components/shared/ColorPicker"
import UISelectbox from "components/shared/Dropdown"
import Icon from "components/shared/Icon"
import {
  CUSTOM_THEME_NAME,
  createTheme,
  ThemeConfig,
  toThemeInput,
} from "theme"
import {
  StyledButtonContainer,
  StyledHeader,
  StyledHr,
  StyledSmall,
  StyledThemeCreator,
  StyledThemeCreatorWrapper,
  StyledThemeDesc,
} from "./styled-components"

interface ThemeOptionBuilder {
  desc: string
  title: string
  component: any
  options?: any[]
  getValue: (value: string, config: ThemeOptionBuilder) => any
}

const valueToColor = (value: string, _config: ThemeOptionBuilder): string =>
  toHex(value).toUpperCase()

const displayFontOption = (
  font: CustomThemeConfig.FontFamily | string
): string =>
  // @ts-ignore
  humanizeString(CustomThemeConfig.FontFamily[font])

const themeBuilder: Record<string, ThemeOptionBuilder> = {
  primaryColor: {
    desc: "Primary accent color for interactive elements.",
    title: "Primary color",
    component: ColorPicker,
    getValue: valueToColor,
  },
  backgroundColor: {
    desc: "Background color for the main content area.",
    title: "Background color",
    component: ColorPicker,
    getValue: valueToColor,
  },
  secondaryBackgroundColor: {
    desc:
      "Background color used for the sidebar and most interactive widgets.",
    title: "Secondary background color",
    component: ColorPicker,
    getValue: valueToColor,
  },
  textColor: {
    desc: "Color used for almost all text.",
    title: "Text color",
    component: ColorPicker,
    getValue: valueToColor,
  },
  font: {
    desc: "Font family for all text in the app, except code blocks.",
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

const ThemeCreator = (): ReactElement => {
  const [copied, updateCopied] = React.useState(false)
  const [isOpen, openCreator] = React.useState(false)
  const themeCreator = React.useRef<HTMLDivElement>(null)
  const { activeTheme, addThemes, setTheme } = React.useContext(
    PageLayoutContext
  )

  const themeInput = toThemeInput(activeTheme.emotion)

  const updateTheme = (customTheme: ThemeConfig): void => {
    addThemes([customTheme])
    setTheme(customTheme)
  }

  const onThemeOptionChange = (key: string, newVal: string): void => {
    const customTheme = createTheme(CUSTOM_THEME_NAME, {
      ...themeInput,
      [key]: newVal,
    })
    updateTheme(customTheme)
    updateCopied(false)
  }

  const config = `[theme]
primaryColor="${themeInput.primaryColor}"
backgroundColor="${themeInput.backgroundColor}"
secondaryBackgroundColor="${themeInput.secondaryBackgroundColor}"
textColor="${themeInput.textColor}"
font="${displayFontOption(
    themeInput.font || CustomThemeConfig.FontFamily.SANS_SERIF
  ).toLowerCase()}"
`

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
    updateCopied(true)
  }

  const renderThemeOption = (
    themeOption: string,
    value: string
  ): ReactElement | null => {
    const themeOptionConfig = themeBuilder[themeOption]
    if (themeOptionConfig === undefined) return null

    const isColor = themeOptionConfig.component === ColorPicker
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
          <StyledHr />
          <StyledHeader>Edit active theme</StyledHeader>
          <p>
            Changes exist for the duration of a session. To discard changes and
            recover the original themes, refresh the page.
          </p>
          <StyledThemeCreator>
            {Object.entries(themeInput).map(([themeOption, value]) =>
              renderThemeOption(themeOption, value as string)
            )}
          </StyledThemeCreator>

          <StyledSmall>
            To save this theme, paste it into the <code>[theme]</code> section
            of your <code>.streamlit/config.toml</code> file.
          </StyledSmall>
          <StyledButtonContainer>
            <Button onClick={copyConfig} kind={Kind.PRIMARY}>
              {copied ? (
                <>
                  {"Copied to clipboard "}
                  <Icon
                    content={Check}
                    size="lg"
                    color={activeTheme.emotion.colors.success}
                  />
                </>
              ) : (
                "Copy theme to clipboard"
              )}
            </Button>
          </StyledButtonContainer>
        </>
      ) : (
        <Button onClick={toggleCreatorUI} kind={Kind.PRIMARY}>
          Edit active theme
        </Button>
      )}
    </StyledThemeCreatorWrapper>
  )
}

export default ThemeCreator
