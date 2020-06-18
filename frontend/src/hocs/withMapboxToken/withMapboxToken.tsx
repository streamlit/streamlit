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

import React, { ComponentType, PureComponent } from "react"
import { makeElementWithInfoText } from "lib/utils"
import hoistNonReactStatics from "hoist-non-react-statics"
import { MapboxToken } from "hocs/withMapboxToken/MapboxToken"

import MapboxTokenError from "./MapboxTokenError"
import Alert from "components/elements/Alert"

interface Props {
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

const withMapboxToken = (deltaType: string) => (
  WrappedComponent: ComponentType<any>
): ComponentType<any> => {
  class WithMapboxToken extends PureComponent<Props, State> {
    public static readonly displayName = `withMapboxToken(${WrappedComponent.displayName ||
      WrappedComponent.name})`

    public constructor(props: Props) {
      super(props)

      this.state = {
        isFetching: true,
        mapboxToken: undefined,
        mapboxTokenError: undefined,
      }

      this.initMapboxToken()
    }

    /**
     * Fetch our MapboxToken.
     */
    private initMapboxToken = async (): Promise<void> => {
      try {
        const mapboxToken = await MapboxToken.get()

        this.setState({
          mapboxToken,
          isFetching: false,
        })
      } catch (error) {
        this.setState({
          mapboxTokenError: error,
          isFetching: false,
        })
      }
    }

    public render = (): JSX.Element => {
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
        return (
          <Alert
            element={makeElementWithInfoText("Loading...").get("alert")}
            width={width}
          />
        )
      }

      // We have the mapbox token. Pass it through to our component.
      return <WrappedComponent mapboxToken={mapboxToken} {...this.props} />
    }
  }

  return hoistNonReactStatics(WithMapboxToken, WrappedComponent)
}

export default withMapboxToken
