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
import hoistNonReactStatics from "hoist-non-react-statics"
import { MapboxToken } from "hocs/withMapboxToken/MapboxToken"
import ErrorElement from "components/shared/ErrorElement"
import Alert from "components/elements/Alert"
import { makeElementWithInfoText } from "lib/utils"

interface Props {
  width: number
}

interface State {
  mapboxToken?: string
  mapboxTokenError?: Error
}

/**
 * A higher-order component that fetches our mapbox token and passes
 * it through to the wrapped component. If the token fetch fails, an error
 * will be rendered in place of the wrapped component.
 */
function withMapboxToken(
  WrappedComponent: ComponentType<any>
): ComponentType<any> {
  class WithMapboxToken extends PureComponent<Props, State> {
    public static readonly displayName = `withMapboxToken(${WrappedComponent.displayName ||
      WrappedComponent.name})`

    public constructor(props: Props) {
      super(props)

      this.state = {
        mapboxToken: undefined,
        mapboxTokenError: undefined,
      }
      this.initMapboxToken()
    }

    /**
     * Fetch our MapboxToken.
     */
    private initMapboxToken = (): void => {
      MapboxToken.get()
        .then(token => this.setState({ mapboxToken: token }))
        .catch(error => this.setState({ mapboxTokenError: error }))
    }

    public render = (): JSX.Element => {
      // We got an error when fetching our mapbox token: show the error.
      if (this.state.mapboxTokenError != null) {
        return (
          <ErrorElement
            width={this.props.width}
            name="Error fetching Mapbox token"
            message={this.state.mapboxTokenError.message}
          />
        )
      }

      // If our mapboxToken hasn't been retrieved yet, show a loading alert.
      if (this.state.mapboxToken === undefined) {
        return (
          <Alert
            element={makeElementWithInfoText("Loading...").get("alert")}
            width={this.props.width}
          />
        )
      }

      // We have the mapbox token. Pass it through to our component.
      return (
        <WrappedComponent
          mapboxToken={this.state.mapboxToken}
          {...this.props}
        />
      )
    }
  }

  return hoistNonReactStatics(WithMapboxToken, WrappedComponent)
}

export default withMapboxToken
