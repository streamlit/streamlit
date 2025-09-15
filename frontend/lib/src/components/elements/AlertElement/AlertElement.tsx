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

import React, { memo, ReactElement } from "react"

import AlertContainer, { Kind } from "~lib/components/shared/AlertContainer"
import { DynamicIcon } from "~lib/components/shared/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"

import { StyledAlertContent } from "./styled-components"

export interface AlertElementProps {
  body: string
  icon?: string
  kind: Kind
}

/**
 * Display an (error|warning|info|success) box with a Markdown-formatted body.
 */
function AlertElement({
  icon,
  body,
  kind,
}: Readonly<AlertElementProps>): ReactElement {
  const theme = useEmotionTheme()
  const markdownWidth = {
    // Fix issue #6394 - Need to account for icon size (iconSizes.lg) + gap when icon present
    width: icon
      ? `calc(100% - (${theme.iconSizes.lg} + ${theme.spacing.sm}))`
      : "100%",
  }

  return (
    <div className="stAlert" data-testid="stAlert">
      <AlertContainer kind={kind}>
        <StyledAlertContent>
          {icon && (
            <DynamicIcon
              iconValue={icon}
              size="lg"
              testid="stAlertDynamicIcon"
            />
          )}

          <StreamlitMarkdown
            source={body}
            allowHTML={false}
            style={markdownWidth}
          />
        </StyledAlertContent>
      </AlertContainer>
    </div>
  )
}

export default memo(AlertElement)
