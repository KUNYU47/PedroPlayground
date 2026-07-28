from pedro import *


def turn_right() -> None:
    """Turn Pedro 90 degrees clockwise by performing three left turns.

    Works in any pre-condition state. Does not return a value.
    """
    # TODO: 3 turn_left() calls


def step_up() -> None:
    """Pedro takes one step up the mountain.

    Pre-condition:  Pedro is facing the mountain wall (front is blocked).
    Post-condition: Pedro is one step higher, facing east.
    Does not return a value.
    """
    # TODO: exactly 4 commands — turn_left, move, turn_right, move


def step_down() -> None:
    """Pedro takes one step down the mountain.

    Pre-condition:  Pedro is on a step, facing east.
    Post-condition: Pedro is one step lower, facing east.
    Does not return a value.
    """
    # TODO: mirror of step_up — move, turn_right, move, turn_left


def climb_up_mountain() -> None:
    """Climb up the mountain until Pedro reaches the top.

    Uses step_up() repeatedly while Pedro's front is blocked by
    the mountain wall. Post-condition: Pedro is at the top, facing east.
    Does not return a value.
    """
    # TODO: while front is NOT clear, step up


def climb_down() -> None:
    """Climb down the mountain until Pedro reaches the bottom.

    Uses step_down() repeatedly while Pedro's front is clear.
    Pre-condition:  Pedro is at the top, facing east.
    Post-condition: Pedro is at the bottom, facing east.
    Does not return a value.
    """
    # TODO: while front IS clear, step down


def plant_apollo_flag() -> None:
    """Plant the Apollo flag at Pedro's current position.

    Does not return a value.
    """
    plant_flag()


def main() -> None:
    """Mission: Climb up the mountain, plant the flag,
    then climb down the other side.
    """
    climb_up_mountain()
    plant_apollo_flag()
    climb_down()


if __name__ == '__main__':
    main()
