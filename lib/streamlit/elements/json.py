import json

from streamlit.proto.Json_pb2 import Json as JsonProto


class JsonMixin:
    def json(dg, body):
        """Display object or string as a pretty-printed JSON string.

        Parameters
        ----------
        body : Object or str
            The object to print as JSON. All referenced objects should be
            serializable to JSON as well. If object is a string, we assume it
            contains serialized JSON.

        Example
        -------
        >>> st.json({
        ...     'foo': 'bar',
        ...     'baz': 'boz',
        ...     'stuff': [
        ...         'stuff 1',
        ...         'stuff 2',
        ...         'stuff 3',
        ...         'stuff 5',
        ...     ],
        ... })

        .. output::
           https://static.streamlit.io/0.25.0-2JkNY/index.html?id=CTFkMQd89hw3yZbZ4AUymS
           height: 280px

        """
        import streamlit as st

        if not isinstance(body, str):
            try:
                body = json.dumps(body, default=lambda o: str(type(o)))
            except TypeError as err:
                st.warning(
                    "Warning: this data structure was not fully serializable as "
                    "JSON due to one or more unexpected keys.  (Error was: %s)" % err
                )
                body = json.dumps(body, skipkeys=True, default=lambda o: str(type(o)))

        json_proto = JsonProto()
        json_proto.body = body
        return dg._enqueue("json", json_proto)  # type: ignore
