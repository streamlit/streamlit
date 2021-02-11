import React, { ReactElement } from "react"
import { CustomThemeConfig } from "autogen/proto"
import ColorPicker from "components/shared/ColorPicker"
import { StyledThemeCreator } from "./styled-components"

export interface Props {
  themeInput: Partial<CustomThemeConfig>
  updateThemeInput: (themeInput: Partial<CustomThemeConfig>) => any
}

const ThemeCreator = ({
  themeInput,
  updateThemeInput,
}: Props): ReactElement => {
  const { font, name, ...colors } = themeInput
  const onColorChange = (key: string, color: string): void => {
    updateThemeInput({
      ...themeInput,
      [key]: color,
    })
  }

  return (
    <StyledThemeCreator>
      {Object.entries(colors).map(([key, value]) => (
        <ColorPicker
          key={key}
          width={200}
          disabled={false}
          value={value as string}
          label={key}
          onChange={color => onColorChange(key, color)}
        />
      ))}
    </StyledThemeCreator>
  )
}

export default ThemeCreator
