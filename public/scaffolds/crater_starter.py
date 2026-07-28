from pedro import *


def turn_right() -> None:
    """Turn Pedro 90 degrees clockwise by performing three left turns.

    Does not return a value.
    """
    # TODO: Write 3 turn_left() calls


def navigate_crater_edge() -> None:
    """Step around and over a crater edge obstruction.

    Pre-condition:  Pedro's path is blocked by a crater edge (wall ahead).
    Post-condition: Pedro has stepped around and over the crater,
                    facing east, ready to continue.
    Does not return a value.
    """
    # TODO: 8 commands to go around the crater edge
    #       turn_right, move, turn_left, move, move,
    #       turn_left, move, turn_right


def navigate_surface() -> None:
    """Cross the lunar surface collecting flags until four are found.

    Pre-condition:  Pedro at start of row, facing east.
    Post-condition: Pedro at the far wall, facing east.

    Returns:
        The number of flags collected (always 4 on success).
    """
    # TODO: Keep a counter (flag_counter) of how many flags collected
    #       Use a while loop to continue until 4 flags are collected
    #       Inside: if there's a flag, pick it up and add to counter
    #               if front is clear, move forward
    #               if front is blocked, navigate the crater edge


def main() -> None:
    """Mission: Cross the lunar surface, collecting 4 flags and
    navigating around crater edges along the way.
    """
    navigate_surface()


if __name__ == '__main__':
    main()
