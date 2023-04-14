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
import { EmotionTheme } from "src/lib/theme"
import { useTheme } from "@emotion/react"

interface IDeployCardProps {
  children?: React.ReactNode
}

function DeployCard(
  props: React.PropsWithChildren<IDeployCardProps>
): ReactElement {
  const { colors, spacing }: EmotionTheme = useTheme()
  const { children } = props
  return (
    <Card
      overrides={{
        Root: {
          style: {
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: colors.gray40,
            borderRadius: "8px",
            minHeight: "330px",
            marginTop: spacing.xl,
            marginLeft: spacing.xl,
            marginRight: spacing.xl,
            marginBottom: spacing.xl,
          },
        },
        Body: {
          style: {
            padding: spacing.twoXL,
          },
        },
      }}
    >
      {children}
    </Card>
  )
}

export default DeployCard
