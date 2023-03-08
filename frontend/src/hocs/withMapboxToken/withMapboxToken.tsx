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

import Alert from "src/components/elements/Alert"
import { Kind } from "src/components/shared/AlertContainer"
import { MapboxToken } from "src/hocs/withMapboxToken/MapboxToken"
import { ensureError } from "src/lib/ErrorHandling"
import hoistNonReactStatics from "hoist-non-react-statics"
import React, { ComponentType, PureComponent, ReactNode } from "react"
import { SessionInfo } from "src/lib/SessionInfo"
import MapboxTokenError from "./MapboxTokenError"

interface Props {
  /** The application's SessionInfo instance. */
  sessionInfo: SessionInfo
  width: number
}

interface State {
  mapboxToken?: string
  mapboxTokenError?: Error
  isFetching: boolean
}

/**
 * A higher-order component that fetches our mapbox token and passes
 * it through to the wrapped component. If the token fetch fails, an error
 * will be rendered in place of the wrapped component.
 *
 * @param {string} deltaType In case of an exception we show an error with this
 */

const withMapboxToken =
  (deltaType: string) =>
  (WrappedComponent: ComponentType<any>): ComponentType<any> => {
    class WithMapboxToken extends PureComponent<Props, State> {
      public static readonly displayName = `withMapboxToken(${
        WrappedComponent.displayName || WrappedComponent.name
      })`

      public constructor(props: Props) {
        super(props)

        this.state = {
          isFetching: true,
          mapboxToken: undefined,
          mapboxTokenError: undefined,
        }

        this.initMapboxToken().finally()
      }

      /**
       * Fetch our MapboxToken.
       */
      private initMapboxToken = async (): Promise<void> => {
        try {
          const mapboxToken = await MapboxToken.get(this.props.sessionInfo)

          this.setState({
            mapboxToken,
            isFetching: false,
          })
        } catch (e) {
          const error = ensureError(e)

          this.setState({
            mapboxTokenError: error,
            isFetching: false,
          })
        }
      }

      public render = (): ReactNode => {
        const { mapboxToken, mapboxTokenError, isFetching } = this.state
        const { width } = this.props

        // We got an error when fetching our mapbox token: show the error.
        if (mapboxTokenError) {
          return (
            <MapboxTokenError
              width={width}
              error={mapboxTokenError}
              deltaType={deltaType}
            />
          )
        }

        // If our mapboxToken hasn't been retrieved yet, show a loading alert.
        if (isFetching) {
          return <Alert body={"Loading..."} kind={Kind.INFO} width={width} />
        }

        // We have the mapbox token. Pass it through to our component.
        return <WrappedComponent mapboxToken={mapboxToken} {...this.props} />
      }
    }

    return hoistNonReactStatics(WithMapboxToken, WrappedComponent)
  }

export default withMapboxToken
