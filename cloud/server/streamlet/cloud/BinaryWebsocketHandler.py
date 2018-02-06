import aiohttp

class BinaryWebsocketHandler:
    """Instantiated when a websocket connection is established.

    A subclass (say MyHandler) should be created as follows:

    app = aiohttp.web.Application()
    app.router.add_get(uri, MyHandler.get_handler())

    and may implement any of the following methods:

    MyHandler.on_open
    MyHandler.on_message
    MyHandler.on_close
    """

    async def on_open(self, request):
        """Called when the stream is opened."""
        pass

    async def on_message(self, msg):
        """Called everytime a message is received."""
        pass

    async def on_close(self):
        """Called when the connection is closed."""
        pass

    @classmethod
    def get_handler(cls):
        async def handler_wrapper(request):
            """Handle a new stream."""
            handler = cls()
            await handler.on_open(request)
            ws = aiohttp.web.WebSocketResponse()
            await ws.prepare(request)
            async for msg in ws:
                if msg.type == aiohttp.WSMsgType.BINARY:
                    await handler.on_message(msg.data)
                elif msg.type == aiohttp.WSMsgType.CLOSE:
                    ws.close()
                    await handler.on_close()
                elif msg.type == aiohttp.aiohttp.WSMsgType.ERROR:
                    print('ws connection closed with exception %s' %
                          ws.exception())
                else:
                    print(f'Received incorrect message type {msg.type.name}.')

            print('websocket connection closed')

            return ws
        return handler_wrapper
