from pprint import pprint


class Widgets(object):
    _singleton = None

    @classmethod
    def get_current(cls):
        """
        Returns
        -------
        Widgets
            The singleton Widgets instance

        """
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

    def get_widget_value(self, id):
        """Returns the value of a widget

        Parameters
        ----------
        id : str
            The widget's ID

        Returns
        -------
        Any | None
            The widget's current value, or None if the widget's value hasn't
            been set.

        """
        return self._state.get(id)

    def set_state(self, state):
        """Sets the state dictionary for all widgets

        Parameters
        ----------
        state : dict
            A mapping of widgetID -> value

        """
        self._state = state

    def dump(self):
        pprint(self._state)
