"""Exec a command in a new process group on Linux and macOS.

The PID stays unchanged so down.sh can stop the recorded process group.
"""

import os
import sys

os.setsid()
os.execvp(sys.argv[1], sys.argv[1:])
