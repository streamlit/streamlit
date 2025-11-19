/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { useEmotionTheme } from "@streamlit/lib"

interface IDeployCardProps {
  children?: React.ReactNode
}

function DeployCard(
  props: React.PropsWithChildren<IDeployCardProps>
): ReactElement {
  const { colors, spacing, radii, breakpoints, sizes } = useEmotionTheme()
  const { children } = props
  return (
    <Card
      overrides={{
        Root: {
          style: {
            borderTopWidth: sizes.borderWidth,
            borderBottomWidth: sizes.borderWidth,
            borderLeftWidth: sizes.borderWidth,
            borderRightWidth: sizes.borderWidth,

            borderTopStyle: "solid",
            borderBottomStyle: "none",
            borderLeftStyle: "none",
            borderRightStyle: "solid",

            borderTopColor: colors.borderColor,
            borderBottomColor: colors.borderColor,
            borderLeftColor: colors.borderColor,
            borderRightColor: colors.borderColor,

            borderTopLeftRadius: "none",
            borderTopRightRadius: "none",
            borderBottomLeftRadius: "none",
            borderBottomRightRadius: "none",

            ":last-child": {
              borderRightStyle: "none",
              borderBottomRightRadius: radii.xl,
            },
            ":first-child": {
              borderBottomLeftRadius: radii.xl,
            },

            [`@media (max-width: ${breakpoints.md})`]: {
              ":last-child": {
                borderBottomLeftRadius: radii.xl,
              },
            },
          },
        },
        Contents: {
          style: {
            marginBottom: 0,
            marginTop: 0,
            marginLeft: 0,
            marginRight: 0,
            height: "100%",
          },
        },
        Body: {
          style: {
            padding: spacing.twoXL,
            marginBottom: 0,
            marginTop: 0,
            marginLeft: 0,
            marginRight: 0,
            height: "100%",

            display: "flex",
            flexDirection: "column",

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
