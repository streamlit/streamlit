/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement } from "react"
import { Card } from "baseui/card"
import { EmotionTheme } from "@streamlit/lib"
import { useTheme } from "@emotion/react"

interface IDeployCardProps {
  children?: React.ReactNode
}

function DeployCard(
  props: React.PropsWithChildren<IDeployCardProps>
): ReactElement {
  const { colors, spacing, radii, breakpoints }: EmotionTheme = useTheme()
  const { children } = props
  return (
    <Card
      overrides={{
        Root: {
          style: {
            borderTopWidth: "1px",
            borderBottomWidth: "1px",
            borderLeftWidth: "1px",
            borderRightWidth: "1px",

            borderTopStyle: "solid",
            borderBottomStyle: "solid",
            borderLeftStyle: "solid",
            borderRightStyle: "solid",

            borderTopColor: colors.fadedText10,
            borderBottomColor: colors.fadedText10,
            borderLeftColor: colors.fadedText10,
            borderRightColor: colors.fadedText10,

            borderTopLeftRadius: radii.lg,
            borderTopRightRadius: radii.lg,
            borderBottomLeftRadius: radii.lg,
            borderBottomRightRadius: radii.lg,
          },
        },
        Contents: {
          style: {
            marginBottom: 0,
            marginTop: 0,
            marginLeft: 0,
            marginRight: 0,
          },
        },
        Body: {
          style: {
            padding: spacing.threeXL,
            marginBottom: 0,
            marginTop: 0,
            marginLeft: 0,
            marginRight: 0,

            [`@media (max-width: ${breakpoints.md})`]: {
              padding: spacing.xl,
            },
          },
        },
      }}
    >
      {children}
    </Card>
  )
}

export default DeployCard
