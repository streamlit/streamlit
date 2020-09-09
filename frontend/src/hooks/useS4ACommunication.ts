import { useEffect, useState } from "react"

const S4A_COMM_VERSION = 1

export type IMenuItem =
  | {
      type: "text"
      label: string
      key: string
    }
  | {
      type: "separator"
    }

type IHostToGuestMessage = {
  stCommVersion: number
} & (
  | {
      type: "SET_MENU_ITEMS"
      items: IMenuItem[]
    }
  | {
      type: "UPDATE_FROM_QUERY_PARAMS"
      queryParams: string
    })

type IGuestToHostMessage =
  | {
      type: "GUEST_READY"
    }
  | {
      type: "MENU_ITEM_CALLBACK"
      key: string
    }
  | {
      type: "SET_PAGE_TITLE"
      title: string
    }
  | {
      type: "SET_PAGE_FAVICON"
      favicon: string
    }
  | {
      type: "SET_QUERY_PARAM"
      queryParams: string
    }

type VersionedMessage<Message> = {
  stCommVersion: number
} & Message

export function sendS4AMessage(message: IGuestToHostMessage): void {
  console.log("== sending message to s4a", message)
  window.parent.postMessage(
    {
      stCommVersion: S4A_COMM_VERSION,
      ...message,
    } as VersionedMessage<IGuestToHostMessage>,
    "*"
  )
}

interface ICommunicationResponse {
  items: IMenuItem[]
  queryParams: string
}

function useS4ACommunication(): ICommunicationResponse {
  const [queryParams, setQueryParams] = useState("")
  const [items, setItems] = useState<IMenuItem[]>([])

  useEffect(() => {
    sendS4AMessage({
      type: "GUEST_READY",
    })
  }, [])

  useEffect(() => {
    function receiveMessage(event: MessageEvent): void {
      const message: VersionedMessage<IHostToGuestMessage> = event.data

      if (
        event.origin !== window.location.origin ||
        message.stCommVersion !== S4A_COMM_VERSION
      )
        return

      console.log("== receiving message within core", message)

      if (message.type === "SET_MENU_ITEMS") {
        setItems(message.items)
      }

      if (message.type === "UPDATE_FROM_QUERY_PARAMS") {
        console.log("== setting query params state", message)
        setQueryParams(message.queryParams)
      }
    }

    window.addEventListener("message", receiveMessage)

    return () => {
      window.removeEventListener("message", receiveMessage)
    }
  }, [])

  return {
    items,
    queryParams,
  }
}

export default useS4ACommunication
