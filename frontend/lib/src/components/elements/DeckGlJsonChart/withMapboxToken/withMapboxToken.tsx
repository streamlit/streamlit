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

import React, { ComponentType, PureComponent, ReactNode } from "react"
import hoistNonReactStatics from "hoist-non-react-statics"
import axios from "axios"
import { ensureError } from "@streamlit/lib/src/util/ErrorHandling"

import {
  DeckGlJsonChart,
  Skeleton as SkeletonProto,
} from "@streamlit/lib/src/proto"

import { Skeleton } from "@streamlit/lib/src/components/elements/Skeleton"
import { LibContext } from "@streamlit/lib/src/components/core/LibContext"
import MapboxTokenError from "./MapboxTokenError"

interface InjectedProps {
  mapboxToken: string
}

interface State {
  mapboxToken?: string
  mapboxTokenError?: Error
  isFetching: boolean
}

// Wraps a Component expecting a "mapboxToken" prop.
// The wrapped Component accepts a DeckGLJsonChart prop, which
// incorporates the config.toml token (if provided) and omits the "mapboxToken" prop.
export type WrappedMapboxProps<P extends InjectedProps> = Omit<
  P,
  "mapboxToken"
> & {
  element: DeckGlJsonChart
  width: number
}

export class MapboxTokenNotProvidedError extends Error {}
export class MapboxTokenFetchingError extends Error {}

/**
 * A remote file that stores user-visible tokens.
 */
export const TOKENS_URL = "https://data.streamlit.io/tokens.json"
const MAPBOX = "mapbox"

/**
 * A higher-order component that fetches our mapbox token and passes
 * it through to the wrapped component.
 * This component uses tokens from config.toml first when available.
 * If the token fetch fails, an error will be rendered in place of the wrapped component.
 * This component is necessary as it's good practice to separate data collection
 * (mapbox token retrieval) and the actual rendering of a component.
 *
 * @param {string} deltaType In case of an exception we show an error with this
 */

const withMapboxToken =
  (deltaType: string) =>
  <P extends InjectedProps>(
    WrappedComponent: ComponentType<React.PropsWithChildren<P>>
  ) => {
    // Return a wrapper that accepts the wrapped component's props, minus
    // "mapboxToken". The wrapper will fetch the mapboxToken and inject it into
    // the wrapped component automatically.
    class WithMapboxToken extends PureComponent<WrappedMapboxProps<P>, State> {
      public static readonly displayName = `withMapboxToken(${
        WrappedComponent.displayName || WrappedComponent.name
      })`

      static contextType = LibContext

      context!: React.ContextType<typeof LibContext>

      public constructor(props: WrappedMapboxProps<P>) {
        super(props)

        this.state = {
          isFetching: true,
          mapboxToken: undefined,
          mapboxTokenError: undefined,
        }
      }

      /**
       * Fetch the remote "tokens.json" set the "mapbox" in state.
       * Throw an error if we can't contact TOKENS_URL or the token is missing.
       */
      public initMapboxToken = async (): Promise<void> => {
        try {
          const response = await axios.get(TOKENS_URL)
          const { [MAPBOX]: token } = response.data

          if (!token) {
            throw new Error(`Missing token ${MAPBOX}`)
          }

          this.setState({
            mapboxToken: token,
            isFetching: false,
          })
        } catch (e) {
          const error = ensureError(e)

          this.setState({
            mapboxTokenError: error,
            isFetching: false,
          })
          throw new MapboxTokenFetchingError(
            `${error.message} (${TOKENS_URL})`
          )
        }
      }

      public componentDidMount(): void {
        const mapboxToken =
          this.props.element.mapboxToken || this.context.libConfig.mapboxToken

        if (mapboxToken) {
          this.setState({
            mapboxToken,
            isFetching: false,
          })
        } else {
          this.initMapboxToken()
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

        // If our mapboxToken hasn't been retrieved yet, show a loading
        // skeleton.
        if (isFetching) {
          return (
            <Skeleton
              element={SkeletonProto.create({
                style: SkeletonProto.SkeletonStyle.ELEMENT,
              })}
            />
          )
        }

        // We have the mapbox token. Pass it through to our component.
        return (
          // (this.props as unknown as P) is required to work around a TS issue:
          // https://github.com/microsoft/TypeScript/issues/28938#issuecomment-450636046
          <WrappedComponent
            {...(this.props as unknown as P)}
            mapboxToken={mapboxToken}
            width={width}
          />
        )
      }
    }

    return hoistNonReactStatics(WithMapboxToken, WrappedComponent)
  }

export default withMapboxToken
