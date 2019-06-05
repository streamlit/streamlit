from pprint import pprint


class Widgets(object):
    pass
    _singleton = None

    @classmethod
    def get_current(cls):
        """Return the singleton instance."""
        if cls._singleton is None:
            Widgets()

        return Widgets._singleton

    def __init__(self):
        """Initialize class."""
        if Widgets._singleton is not None:
            raise RuntimeError(
                'Widgets already initialized. Use .get_current() instead')

        Widgets._singleton = self
        self._state = {}

    def get(self, id):
        return self._state.get(id)

    def set(self, state):
        self._state = state

    def dump(self):
        pprint(self._state)
