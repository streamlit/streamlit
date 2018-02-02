"""
A notebook that can be used to print rich data to a local website.
"""


class Server:
    """An asyncio server which stores deltas on the datastructure and
    serves it up through websockets (and possible http in the future).
    """
