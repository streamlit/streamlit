"""Methods for serializing a BSON ObjectId into a protobuf.ObjectId."""

import bson
import struct

def unmarshall_object_id(proto_object_id):
    """Returns the BSON.ObjectId specified in this protobuf.ObjectId."""
    return bson.ObjectId(struct.pack('!LQ',
        proto_object_id.first_part, proto_object_id.second_part))

def marshall_object_id(object_id, proto_object_id):
    """Converts the BSON.ObjectId to a protobuf.ObjectId."""
    proto_object_id.first_part, proto_object_id.second_part = \
        struct.unpack('!LQ', object_id.binary)
