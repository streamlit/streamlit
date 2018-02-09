"""Package for the Switchboard class, which contains and manages
a set of NotebookQueues."""

import asyncio
import contextlib

from streamlet.shared import protobuf
from streamlet.shared.config import get_config as get_shared_config
from streamlet.shared.NotebookQueue import NotebookQueue

class Switchboard:
    """Contains a set of NotebookQueues and manages thier incoming, outgoing
    connections."""

    def __init__(self):
        """Constructor."""
        # This is where we store the master queues which are replicated every
        # time we ge a new consumer.
        self._master_queues = {}

        # This is the set of all queues, both master and not.
        self._queues = {}

    @contextlib.contextmanager
    def stream_to(self, notebook_id):
        """Returns an asyncrhonous consumer with which we can stream data to
        this menagerie:

        with menagerie.stream_to(notebook_id) as consume:
            async for delta_list in delta_list_iter:
                consume(delta_list)
            ...
        """
        # This context manager ensures that a master queue exists as long as
        # this stream is open.
        try:
            # Before the stream opens, create the master queue.
            queue = NotebookQueue()
            self._master_queues[notebook_id] = queue
            self._queues.setdefault(notebook_id, []).append(queue)

            # Now yield a method to add deltas to this master queue.
            yield self._add_deltas_func(notebook_id)

        finally:
            # The stream is closed so we remove references to queue.
            del self._master_queues[notebook_id]
            self._queues[notebook_id].remove(queue)
            if len(self._queues[notebook_id]) == 0:
                del self._queues[notebook_id]

    async def stream_from(self, notebook_id):
        """Returns a producer (i.e. iterator) from which we can stream data
        from this menagerie:

        async for delta_list in menagerie.stream_from(notebook_id):
            delta_list in producer:
                ...
        """
        # Before the stream opens, create the slave queue.
        assert notebook_id in self._master_queues, \
            f'Cannot stream from {notebook_id} without a master queue.'
        queue = self._master_queues[notebook_id].clone()
        self._queues.setdefault(notebook_id, []).append(queue)

        try:
            # This generator's lifetime is bound by our master queue.
            throttleSecs = get_shared_config('local.throttleSecs')
            while notebook_id in self._master_queues:
                deltas = queue.get_deltas()
                if deltas:
                    delta_list = protobuf.DeltaList()
                    delta_list.deltas.extend(deltas)
                    yield delta_list
                await asyncio.sleep(throttleSecs)
            print(f'Master queue is gone, shutting down the slave queue for {notebook_id}.')
        finally:
            # The stream is closed so we remove references to queue.
            self._queues[notebook_id].remove(queue)
            if len(self._queues[notebook_id]) == 0:
                del self._queues[notebook_id]

        # raise NotImplementedError('Need to rethink this with Switchboards.')
        # # Create a new queue.

        # self._delta_queues.append(queue)
        #
        # # Send queue data over the wire until _server_running becomes False.
        #
        # async def send_deltas():
        #
        #
        #
        # while self._server_running:
        #     await send_deltas()
        #
        # await send_deltas()

    def _add_deltas_func(self, notebook_id):
        """Returns a function which takes a set of deltas and add them to all
        queues associated with this notebook_id."""
        def add_deltas(delta_list):
            print(f'Adding {len(delta_list.deltas)} deltas to {notebook_id}.')
            for delta in delta_list.deltas:
                for queue in self._queues[notebook_id]:
                    queue(delta)
        return add_deltas

# class Consumer:
#     """Created by a call to Switchboard.stream_to. Able to stream in messages
#     from an asychronous producer."""
#
#     def __init__(self, notebook_id):
#         """Constructor."""
#         self._notebook_id = notebook_id
#         self._stream_open = False
#         pass
#
#     def __enter__(self):
#         print('Consumer.__enter__')
#         self._stream_open = True
#         return self
#
#     def __exit__(self, exc_type, exc_val, exc_tb):
#         print('Consumer.__exit__')
#         self._stream_open = False
#
#     def __call__(self, delta_list):
#
#         assert self._stream_open, 'Cannot consume from closed stream.'

class Producer:
    """Created by a call to Switchboard.stream_from. Represents an iterator
    over a set of delta_lists."""

    def __init__(self):
        """Constructor."""
        print('Producer.constructor')
        pass

    def __enter__(self):
        print('Producer.__enter__')

    def __exit__(self, exc_type, exc_val, exc_tb):
        print('Producer.__exit__')

    def __aiter__(self):
        print('Producer.__aiter__')
