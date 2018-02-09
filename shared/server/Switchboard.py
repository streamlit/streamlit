"""Package for the Switchboard class, which contains and manages
a set of DeltaQueues."""

class Switchboard:
    """Contains a set of DeltaQueues and manages thier incoming, outgoing
    connections."""

    def __init__(self):
        """Constructor."""
        print('Switchboard constructor.')
        pass

    def stream_to(self, notebook_id):
        """Returns an asyncrhonous consumer with which we can stream data to
        this menagerie:

        with menagerie.stream_to(notebook_id) as consume:
            async for delta_list in delta_list_iter:
                consume(delta_list)
            ...
        """
        print('Switchboard stream_to')
        return Consumer()

    def stream_from(self, notebook_id):
        """Returns a producer (i.e. iterator) from which we can stream data
        from this menagerie:

        with menagerie.stream_from(notebook_id) as producer:
            async for delta_list in producer:
                ...
        """
        print('Switchboard stream_from')
        return Producer()

class Consumer:
    """Created by a call to Switchboard.stream_to. Able to stream in messages
    from an asychronous producer."""

    def __init__(self):
        """Constructor."""
        print('Consumer.constructor')
        self._stream_open = False;
        pass

    def __enter__(self):
        print('Consumer.__enter__')
        self._stream_open = True

    def __exit__(self, exc_type, exc_val, exc_tb):
        print('Consumer.__exit__')
        self._stream_open = False

    def __call__(self, delta_list):
        print('Consumer.__call__')
        assert self._stream_open, 'Cannot consume from closed stream.'

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
