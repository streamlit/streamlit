/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
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

import HttpClient from "src/lib/HttpClient"
import { SourceCode } from "src/autogen/proto"
import { BaseUriParts } from "./UriUtil"
import Resolver from "src/lib/Resolver"

type DataCallbackFunc<T> = (data: T) => void

interface Props {
  getServerUri: () => BaseUriParts | undefined
  csrfEnabled: boolean
  onSourceCodeChanged: DataCallbackFunc<SourceCode>
}

// This represents what we know about what the server knows.
// (i.e. code that was modified but not yet saved to the server isn't represented here.)
export class SourceCodeManager extends HttpClient {
  // A token indicating which file we have in memory.
  private filenameHash: string = ""

  private syncer: Syncer<SourceCode>

  public constructor(props: Props) {
    super(props.getServerUri, props.csrfEnabled)

    this.syncer = new Syncer(this.fetchSourceCode, props.onSourceCodeChanged)
  }

  public async getSourceCode(): Promise<SourceCode> {
    return this.syncer.getData({ fetchIfOutOfSync: true })
  }

  public async contentChangedRemotely(
    filenameHash: string,
    contentSyncToken: string
  ): Promise<void> {
    if (filenameHash !== this.filenameHash) {
      return
    }

    await this.syncer.setSyncTokenAndMaybeSync(contentSyncToken)
  }

  public async setCurrentFileAndSync(
    filenameHash: string,
    contentSyncToken: string
  ): Promise<void> {
    if (filenameHash === this.filenameHash) {
      return
    }

    this.filenameHash = filenameHash
    this.syncer.reset()

    await this.syncer.setSyncTokenAndMaybeSync(contentSyncToken)
  }

  private fetchSourceCode = async (): Promise<FetchResult<SourceCode>> => {
    const response = await this.request<Uint8Array>("source", {
      method: "GET",
      params: { filenameHash: this.filenameHash },
      responseType: "arraybuffer",
    })

    const sourceCode: SourceCode = SourceCode.decode(
      new Uint8Array(response.data)
    )

    if (sourceCode.filenameHash !== this.filenameHash) {
      throw new Error("Bad response. 'filenameHash' does not match.")
    }

    return {
      data: sourceCode,
      syncToken: "TODO",
    }
  }

  public async storeSourceCode(cells: string[]): Promise<void> {
    const sourceCode = await this.syncer.getData({ fetchIfOutOfSync: false })
    sourceCode.cells = cells

    await this.request<number>("source", {
      method: "PUT",
      //data: SourceCode.encode(sourceCode).finish(),
      data: {
        filenameHash: sourceCode.filenameHash,
        contentSyncToken: sourceCode.contentSyncToken,
        cells: sourceCode.cells,
      },
      headers: {
        //"Content-Type": "application/octet-stream",
        "Content-Type": "application/json",
      },
    })
  }
}

interface FetchResult<T> {
  data: T
  syncToken: string
}

type SyncState =
  | "NO_DATA"
  | "DATA_IS_IN_SYNC"
  | "DATA_IS_OUT_OF_SYNC"
  | "FETCHING_DATA"
type FetchFunc<T> = () => Promise<FetchResult<T>>

/**
 * Helper that keeps some data in sync with the server.
 */
class Syncer<T> {
  private syncState: SyncState = "NO_DATA"
  private data: T | null = null

  // An opaque token that basically works lika a hash of the data. If the outside world tells us
  // the token from the server is different from the token we hold here, then we know we"re out of
  // sync and should re-fetch the data.
  private syncToken: string = ""

  // A promise that gets resolved whenever a fetch is done.
  private fetchPromise: Promise<void> = Promise.reject()

  // The function used to actually fetch data. Should return an object with the following fields:
  // - data: the data itself
  // - syncToken: the latest syncToken (see above for more)
  private fetchFunc: FetchFunc<T>

  // A callback for when new data is fetched from the server.
  private onNewData: DataCallbackFunc<T>

  constructor(fetchFunc: FetchFunc<T>, onNewData: DataCallbackFunc<T>) {
    this.fetchFunc = fetchFunc
    this.onNewData = onNewData
    this.reset()
  }

  reset(): void {
    this.syncState = "NO_DATA"
    this.data = null
    this.syncToken = ""
    this.fetchPromise = Promise.reject()
  }

  async setSyncTokenAndMaybeSync(syncToken: string): Promise<void> {
    if (syncToken === this.syncToken) {
      return
    }

    await this.fetchNow()
  }

  async getData({
    fetchIfOutOfSync,
  }: {
    fetchIfOutOfSync: boolean
  }): Promise<T> {
    switch (this.syncState) {
      case "NO_DATA": {
        // Fetch data and put it in this.data.
        await this.fetchNow()
        break
      }

      // We have data, but we know it's out of sync.
      case "DATA_IS_OUT_OF_SYNC": {
        if (fetchIfOutOfSync) {
          // Fetch data and put it in this.data.
          await this.fetchNow()
        }
        break
      }

      case "FETCHING_DATA": {
        // Wait for current fetch and put results in this.data.
        await this.fetchPromise
        break
      }

      case "DATA_IS_IN_SYNC": {
        // Nothing! The data in this.data is already good.
        break
      }

      default: {
        throw new Error(`Bad state ${this.syncState}`)
      }
    }

    // At this point we can guarantee that the data exists.
    return this.data as T
  }

  async fetchNow(): Promise<void> {
    this.syncState = "FETCHING_DATA"

    const resolver = new Resolver<void>()
    this.fetchPromise = resolver.promise

    try {
      const fetchResult = await this.fetchFunc()
      this.data = fetchResult.data
      this.syncToken = fetchResult.syncToken

      this.syncState = "DATA_IS_IN_SYNC"
      resolver.resolve()

      this.onNewData(this.data)
    } catch (e) {
      this.syncState = "DATA_IS_OUT_OF_SYNC"
      resolver.reject()
      throw e
    }
  }
}
