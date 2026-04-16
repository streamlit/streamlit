/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { memo, ReactElement } from "react"

import AlertContainer, {
  Kind,
} from "~lib/components/shared/AlertContainer/AlertContainer"
import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"

import {
  StyledAlertBody,
  StyledAlertContent,
  StyledAlertHeader,
  StyledAlertIcon,
  StyledAlertTitle,
} from "./styled-components"

export interface AlertElementProps {
  body: string
  icon?: string
  title?: string
  kind: Kind
}

/**
 * Display an (error|warning|info|success) box with a Markdown-formatted body.
 */
function AlertElement({
  icon,
  body,
  title,
  kind,
}: Readonly<AlertElementProps>): ReactElement {
  const theme = useEmotionTheme()

  // Fix issue #6394 - Need to account for icon size (iconSizes.lg) + gap when icon present.
  // Only needed for the no-title layout where icon and body are side by side in a flex row.
  // In the title layout, StyledAlertTitle already constrains width via flexbox.
  const markdownWidth = icon
    ? { width: `calc(100% - (${theme.iconSizes.lg} + ${theme.spacing.sm}))` }
    : undefined

  // Extract icon element to avoid duplication between title and no-title layouts.
  const iconElement = icon ? (
    <StyledAlertIcon>
      <DynamicIcon iconValue={icon} size="lg" testid="stAlertDynamicIcon" />
    </StyledAlertIcon>
  ) : null

  // When there's a title: icon+title in header row, body below (column layout).
  // When no title: icon and body side by side (row layout).
  return (
    <div className="stAlert" data-testid="stAlert">
      <AlertContainer kind={kind}>
        <StyledAlertContent $hasTitle={!!title}>
          {title ? (
            <>
              <StyledAlertHeader>
                {iconElement}
                <StyledAlertTitle data-testid="stAlertTitle">
                  <StreamlitMarkdown
                    source={title}
                    allowHTML={false}
                    isLabel
                    largerLabel
                  />
                </StyledAlertTitle>
              </StyledAlertHeader>
              <StyledAlertBody>
                <StreamlitMarkdown source={body} allowHTML={false} />
              </StyledAlertBody>
            </>
          ) : (
            <>
              {iconElement}
              <StreamlitMarkdown
                source={body}
                allowHTML={false}
                style={markdownWidth}
              />
            </>
          )}
        </StyledAlertContent>
      </AlertContainer>
    </div>
  )
}

export default memo(AlertElement)
