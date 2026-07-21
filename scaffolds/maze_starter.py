from pedro import *


def turn_right() -> None:
    """Turn Pedro 90 degrees clockwise by performing three left turns.

    Does not return a value.
    """
    # TODO: 3 turn_left() calls


def right_is_clear() -> bool:
    """Return True if there is no wall to Pedro's immediate right.

    Pedro must return to his original facing direction after checking.

    Returns:
        True if the cell to Pedro's right is empty, False if it is a wall.
    """
    # TODO: turn_right, check front_is_clear, store result in a variable
    # TODO: turn_left to restore original direction
    # TODO: return the result


def solve_maze() -> None:
    """Navigate the maze using the Right-Hand Rule until the exit flag is found.

    Keep your right hand on the wall at all times:
    - If right is clear, turn right and move forward.
    - Otherwise if front is clear, move forward.
    - Otherwise turn left.

    Post-condition: Pedro has reached the flag (exit).
    Does not return a value.
    """
    # TODO: while no flag is present:
    #   if right_is_clear(): turn_right(); move()
    #   elif front_is_clear(): move()
    #   else: turn_left()


def main() -> None:
    """Mission: Escape the maze using the Right-Hand Rule."""
    solve_maze()


if __name__ == '__main__':
    main()
