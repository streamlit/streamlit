from streamlit.proto.Empty_pb2 import Empty as EmptyProto


class EmptyMixin:
    def empty(dg):
        """Insert a single-element container.

        Inserts a container into your app that can be used to hold a single element.
        This allows you to, for example, remove elements at any point, or replace
        several elements at once (using a child multi-element container).

        To insert/replace/clear an element on the returned container, you can
        use "with" notation or just call methods directly on the returned object.
        See examples below.

        Examples
        --------

        Overwriting elements in-place using "with" notation:

        >>> import time
        >>>
        >>> with st.empty():
        ...     for seconds in range(60):
        ...         st.write(f"⏳ {seconds} seconds have passed")
        ...         time.sleep(1)
        ...     st.write("✔️ 1 minute over!")

        Replacing several elements, then clearing them:

        >>> placeholder = st.empty()
        >>>
        >>> # Replace the placeholder with some text:
        >>> placeholder.text("Hello")
        >>>
        >>> # Replace the text with a chart:
        >>> placeholder.line_chart({"data": [1, 5, 2, 6]})
        >>>
        >>> # Replace the chart with several elements:
        >>> with placeholder.beta_container():
        ...     st.write("This is one element")
        ...     st.write("This is another")
        ...
        >>> # Clear all those elements:
        >>> placeholder.empty()

        """
        empty_proto = EmptyProto()
        # The protobuf needs something to be set
        empty_proto.unused = True
        return dg._enqueue("empty", empty_proto)  # type: ignore
