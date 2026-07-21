import os
import sys
import json
import atexit
import traceback

_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if _CURRENT_DIR not in sys.path:
    sys.path.insert(0, _CURRENT_DIR)

from engine.world import parse_world
from engine.pedro_state import PedroState

_world = None
_pedro = None

_world_path = os.environ.get('PEDRO_WORLD', '')
_output_path = os.environ.get('PEDRO_OUTPUT', '')


def _init():
    global _world, _pedro
    if _world is not None:
        return
    if not _world_path:
        sys.stderr.write("Error: PEDRO_WORLD environment variable not set.\n")
        sys.exit(1)
    try:
        _world, sr, sc, sd = parse_world(_world_path)
        _pedro = PedroState(_world, sr, sc, sd)
    except Exception as e:
        sys.stderr.write(f"Error loading world: {e}\n")
        traceback.print_exc()
        sys.exit(1)


def _save():
    global _pedro, _output_path
    if _pedro is None or not _output_path:
        return
    try:
        snapshots = _pedro.get_snapshots()
        with open(_output_path, 'w', encoding='utf-8') as f:
            json.dump(snapshots, f)
    except Exception:
        pass


atexit.register(_save)


def move():
    _init()
    _pedro.move()


def turn_left():
    _init()
    _pedro.turn_left()


def plant_flag():
    _init()
    _pedro.plant_flag()


def pick_flag():
    _init()
    _pedro.pick_flag()


def front_is_clear():
    _init()
    return _pedro.front_is_clear()


def flag_present():
    _init()
    return _pedro.flag_present()


def facing_north():
    _init()
    return _pedro.facing_north()


def facing_east():
    _init()
    return _pedro.facing_east()
