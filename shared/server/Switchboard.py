"""Package for the Switchboard class, which contains and manages
a set of NotebookQueues."""

import asyncio
import contextlib

from streamlit.shared import protobuf
from streamlit.shared.config import get_config as get_shared_config
from streamlit.shared.NotebookQueue import NotebookQueue
from streamlit.shared.DeltaGenerator import DeltaGenerator

class Switchboard:
    """Contains a set of NotebookQueues and manages thier incoming, outgoing
    connections."""

    def __init__(self, loop, remove_master_queues=True):
        """Constructor.

        loop - The even loop. All interactions with the queues in the
               switchboard happen through this event loop.
        """
        # This is where we store the master queues which are replicated every
        # time we ge a new consumer.
        self._master_queues = {}

        # This is the set of all queues, both master and not.
        self._queues = {}

        # IMPORTANT: From this point of execution on, all interactions with the
        # queues (_master_queues and _queues) happens through this event loop.
        self._loop = loop

        # Big hack!!
        self._remove_master_queues = remove_master_queues

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
        queue = NotebookQueue()
        try:
            # Before the stream opens, create the master queue.
            def async_add_master_queue():
                print(f'Creating master queue for {notebook_id}.')
                self._master_queues[notebook_id] = queue
                self._queues.setdefault(notebook_id, []).append(queue)
            self._loop.call_soon_threadsafe(async_add_master_queue)

            # Now yield a method to add deltas to this master queue.
            yield self._add_deltas_func(notebook_id)

        finally:
            # The stream is closed so we remove references to queue.
            def async_remove_master_queue():
                print(f'Removing master queue for {notebook_id}.')
                del self._master_queues[notebook_id]
                self._queues[notebook_id].remove(queue)
                if len(self._queues[notebook_id]) == 0:
                    del self._queues[notebook_id]
            if self._remove_master_queues:
                self._loop.call_soon_threadsafe(async_remove_master_queue)

    async def stream_from(self, notebook_id):
        """
        Returns a producer (i.e. iterator) from which we can stream data
        from this menagerie:

        async for delta_list in menagerie.stream_from(notebook_id):
            delta_list in producer:
                ...
        """
        # Guard that this is running in the right loop.
        assert asyncio.get_event_loop() == self._loop

        # Clone the master queue to create this child queue.
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

    def _add_deltas_func(self, notebook_id):
        """Returns a function which takes a set of deltas and add them to all
        queues associated with this notebook_id."""
        def add_deltas(delta_list):
            def async_add_deltas():
                for delta in delta_list.deltas:
                    for queue in self._queues[notebook_id]:
                        queue(delta)
            self._loop.call_soon_threadsafe(async_add_deltas)
        return add_deltas
