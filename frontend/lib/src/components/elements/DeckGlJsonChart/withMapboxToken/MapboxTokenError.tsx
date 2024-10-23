/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import ErrorElement from "@streamlit/lib/src/components/shared/ErrorElement"
import { StyledInlineCode } from "@streamlit/lib/src/components/elements/CodeBlock/styled-components"

import {
  MapboxTokenFetchingError,
  MapboxTokenNotProvidedError,
} from "./withMapboxToken"

interface Props {
  error: Error | MapboxTokenFetchingError | MapboxTokenNotProvidedError
  deltaType: string
  width: number
}

const MapboxTokenError = ({
  error,
  width,
  deltaType,
}: Props): ReactElement => {
  if (error instanceof MapboxTokenNotProvidedError) {
    return (
      <ErrorElement
        width={width}
        name="No Mapbox token provided"
        message={
          <>
            <p>
              To use <StyledInlineCode>st.{deltaType}</StyledInlineCode> or{" "}
              <StyledInlineCode>st.map</StyledInlineCode> you need to set up a
              Mapbox access token.
            </p>

            <p>
              To get a token, create an account at{" "}
              <a href="https://mapbox.com">https://mapbox.com</a>. It's free
              for moderate usage levels!
            </p>

            <p>
              Once you have a token, just set it using the Streamlit config
              option <StyledInlineCode>mapbox.token</StyledInlineCode> and
              don't forget to restart your Streamlit server at this point if
              it's still running, then reload this tab.
            </p>

            <p>
              See{" "}
              <a href="https://docs.streamlit.io/develop/api-reference/configuration/config.toml">
                our documentation
              </a>{" "}
              for more info on how to set config options.
            </p>
          </>
        }
      />
    )
  }

  if (error instanceof MapboxTokenFetchingError) {
    return (
      <ErrorElement
        width={width}
        name="Error fetching Streamlit Mapbox token"
        message={
          <>
            <p>This app requires an internet connection.</p>
            <p>Please check your connection and try again.</p>
            <p>
              If you think this is a bug, please file bug report{" "}
              <a href="https://github.com/streamlit/streamlit/issues/new/choose">
                here
              </a>
              .
            </p>
          </>
        }
      />
    )
  }

  return (
    <ErrorElement
      width={width}
      name="Error fetching Streamlit Mapbox token"
      message={error.message}
    />
  )
}

export default MapboxTokenError
