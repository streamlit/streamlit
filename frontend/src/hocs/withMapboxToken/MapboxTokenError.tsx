import React, { ReactElement } from "react"
import ErrorElement from "components/shared/ErrorElement"
import {
  MapboxTokenFetchingError,
  MapboxTokenNotProvidedError,
} from "hocs/withMapboxToken/MapboxToken"

interface Props {
  error: Error | MapboxTokenFetchingError | MapboxTokenNotProvidedError
  width: number
}

const MapboxTokenError = ({ error, width }: Props): ReactElement => {
  if (error instanceof MapboxTokenNotProvidedError) {
    return (
      <ErrorElement
        width={width}
        name="No Mapbox token provided"
        message={
          <>
            To use `st.pydeck_chart` you need to set up a Mapbox access token.
            To get a token, create an account at{" "}
            <a href="https://mapbox.com">https://mapbox.com</a>. It's free for
            moderate usage levels! Once you have a token, just set it using the
            Streamlit config option `mapbox.token`. See{" "}
            <a href="https://docs.streamlit.io/cli.html#view-all-config-options">
              our documentation
            </a>{" "}
            for more info on how to set config options.
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
            This app requires an internet connection. Please when that your
            connection is working and try again. If you think this is a bug,
            please file bug report{" "}
            <a href="https://github.com/streamlit/streamlit/issues/new/choose">
              here
            </a>
            .
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
