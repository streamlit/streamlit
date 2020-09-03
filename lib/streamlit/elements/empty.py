from streamlit.proto.Empty_pb2 import Empty as EmptyProto


class EmptyMixin:
    def empty(dg):
        """Add a placeholder to the app.

        The placeholder can be filled any time by calling methods on the return
        value.

        Example
        -------
        >>> my_placeholder = st.empty()
        >>>
        >>> # Now replace the placeholder with some text:
        >>> my_placeholder.text("Hello world!")
        >>>
        >>> # And replace the text with an image:
        >>> my_placeholder.image(my_image_bytes)

        """
        empty_proto = EmptyProto()
        # The protobuf needs something to be set
        empty_proto.unused = True
        return dg._enqueue("empty", empty_proto)  # type: ignore
