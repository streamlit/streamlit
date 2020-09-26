/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement } from "react"
import { Button as BaseUIButton, KIND } from "baseui/button"
import { themeOverrides } from "lib/widgetTheme"

export interface Props {
  disabled?: boolean
  onClick: (event: React.SyntheticEvent<HTMLElement>) => any
  children: ReactElement
  id?: string
}

const IconButton = ({
  onClick,
  disabled,
  children,
  ...props
}: Props): ReactElement => {
  const overrides = {
    BaseButton: {
      style: ({ $theme }: { $theme: any }) => ({
        color: $theme.colors.mono800,
        padding: 0,
        ":hover": {
          backgroundColor: "transparent",
          color: themeOverrides.colors.primary,
        },
        ":focus": {
          backgroundColor: "transparent",
          color: themeOverrides.colors.primary,
          outline: "none",
        },
        ":active": {
          backgroundColor: "transparent",
          color: themeOverrides.colors.white,
        },
        ":disabled": {
          borderColor: "transparent",
          color: $theme.colors.mono800,
        },
        ":hover:disabled": {
          borderColor: "transparent",
        },
      }),
    },
  }
  return (
    <BaseUIButton
      disabled={disabled}
      onClick={onClick}
      overrides={overrides}
      kind={KIND.minimal}
      {...props}
    >
      {children}
    </BaseUIButton>
  )
}
export default IconButton
