"""Package for the Switchboard class, which contains and manages
a set of DeltaQueues."""

import contextlib
from streamlet.shared.DeltaQueue import DeltaQueue

class Switchboard:
    """Contains a set of DeltaQueues and manages thier incoming, outgoing
    connections."""

    def __init__(self):
        """Constructor."""
        # This is where we store the master queues which are replicated every
        # time we ge a new consumer.
        self._master_queues = {}

        # This is the set of all queues, both master and not.
        self._queues = {}

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
        @contextlib.contextmanager
        def delta_list_consumer():
            try:
                # Before the stream opens, create the master queue.
                queue = DeltaQueue()
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
        return delta_list_consumer()

    def stream_from(self, notebook_id):
        """Returns a producer (i.e. iterator) from which we can stream data
        from this menagerie:

        with menagerie.stream_from(notebook_id) as producer:
            async for delta_list in producer:
                ...
        """
        print('Switchboard stream_from')
        return Producer()

    def _add_deltas_func(self, notebook_id):
        """Returns a function which takes a set of deltas and add them to all
        queues associated with this notebook_id."""
        def add_deltas(delta_list):
            print(f'Adding {len(delta_list.deltas)} deltas to {notebook_id}.')
            for delta in delta_list.deltas:
                for queue in self._queues[notebook_id]:
                    queue.add_delta(delta)
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
