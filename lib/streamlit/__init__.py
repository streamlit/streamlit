# Defe
import pkg_resources
__version__ = pkg_resources.require("streamlit")[0].version

# Import some files directly from this module
from streamlit.Chart import *
from streamlit.caching import cache
from streamlit import io

import os
import pwd
import uuid

def uuid_user():
    mac = str(uuid.getnode())
    user = pwd.getpwuid(os.geteuid()).pw_name
    return str(uuid.uuid3(uuid.NAMESPACE_DNS, mac + user))
