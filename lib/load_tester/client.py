import logging
import base64
from optparse import OptionParser

from tornado import websocket
from tornado.ioloop import IOLoop
import tornado.gen

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.BackMsg_pb2 import BackMsg

logger = logging.getLogger('client')
logger.setLevel(logging.INFO)


def decode_message_from_string(message_type, message):
    obj = ForwardMsg() if message_type == "ForwardMsg" else BackMsg()
    obj.ParseFromString(message)
    return obj, message


def decode_element(element):
    if len(element) == 0:
        return None, None, None
    message_type, message = element.split("-")
    string_encoded_message = base64.b64decode(message)
    obj, string_encoded_message = decode_message_from_string(message_type, string_encoded_message)
    return message_type, obj, string_encoded_message


@tornado.gen.coroutine
def run(url, messages):
    logger.debug(f"Connecting to {url}")
    conn = yield websocket.websocket_connect(url)
    logger.debug("Connection successful.")

    for e in messages:
        message_type, message, encoded_message = decode_element(e)
        if message is None:
            continue

        if message_type == "BackMsg":
            logger.debug(f"BackMessage of type: {message_type}")
            yield conn.write_message(encoded_message, binary=True)
        else:
            logger.debug(f"Waiting for message of type: {message_type}")
            received_message = yield conn.read_message()
            recv_message_obj, _ = decode_message_from_string("ForwardMsg", received_message)
            actual_proto_type = recv_message_obj.WhichOneof("type")
            if actual_proto_type != message.WhichOneof("type"):
                raise RuntimeError(f"Received message has type {actual_proto_type}, expected {message.WhichOneof('type')}")
            logger.debug(f"    ... message from server of type: {actual_proto_type}")


@tornado.gen.coroutine
def run_multi(url, messages, concurrency):
    for _ in range(concurrency):
        yield run(url, messages)


def decode_only(messages):
    for msg in messages:
        message_type, message, _ = decode_element(msg)
        if message is None:
            continue
        logger.info(f"Type: {message_type} Message: {message}")


def main():
    parser = OptionParser()
    parser.add_option("-f", "--file", dest="filename",
                      help="Path to the trace file")
    parser.add_option("-a", "--address", dest="address",
                      help="Server address", default="localhost:8501")
    parser.add_option("-c", "--concurrency", dest="concurrency",
                      help="Number of concurrent runs", default=1, type="int")
    parser.add_option("-d", "--dry",
                      action="store_true", dest="dry", default=False,
                      help="Don't connect")

    (options, args) = parser.parse_args()

    with open(options.filename, "r", encoding="utf-8") as f:
        messages = f.read().split(":")

    if options.dry:
        decode_only(messages)
        return

    IOLoop.current().run_sync(
        lambda: run_multi(f"ws://{options.address}/stream", messages, options.concurrency))


if __name__ == "__main__":
    main()

