import axios from "axios"
import { ensureError } from "src/lib/ErrorHandling"
import { SessionInfo } from "src/lib/SessionInfo"

export class MapboxTokenNotProvidedError extends Error {}
export class MapboxTokenFetchingError extends Error {}

/**
 * A remote file that stores user-visible tokens.
 */
export const TOKENS_URL = "https://data.streamlit.io/tokens.json"

export class MapboxToken {
  static token?: string

  static commandLine?: string

  private static isRunningLocal = (): boolean => {
    const { hostname } = window.location

    return hostname === "localhost" || hostname === "127.0.0.1"
  }

  /**
   * Expose a singleton MapboxToken:
   * - If the user specified a token in their streamlit config, return it.
   * - Else, fetch the remote "tokens.json" and return the "mapbox" entry.
   *
   * (The returned value is cached in memory, so the remote resource will
   * only be fetched once per session.)
   */
  public static async get(): Promise<string> {
    const { commandLine, userMapboxToken } = SessionInfo.current

    if (
      !MapboxToken.token ||
      MapboxToken.commandLine !== commandLine.toLowerCase()
    ) {
      if (userMapboxToken !== "") {
        MapboxToken.token = userMapboxToken
      } else {
        // TODO: Replace this with the block below after October 1st 2020.
        MapboxToken.token = await this.fetchToken(TOKENS_URL, "mapbox")
        // if (this.isRunningLocal() && SessionInfo.isHello) {
        //   MapboxToken.token = await this.fetchToken(TOKENS_URL, "mapbox-localhost")
        // } else {
        //   throw new MapboxTokenNotProvidedError("No Mapbox token provided")
        // }
      }

      MapboxToken.commandLine = commandLine.toLowerCase()
    }

    return MapboxToken.token
  }

  private static async fetchToken(
    url: string,
    tokenName: string
  ): Promise<string> {
    try {
      const response = await axios.get(url)
      const { [tokenName]: token } = response.data

      if (token == null || token === "") {
        throw new Error(`Missing token "${tokenName}"`)
      }

      return token
    } catch (e) {
      const error = ensureError(e)
      throw new MapboxTokenFetchingError(`${error.message} (${url})`)
    }
  }
}
