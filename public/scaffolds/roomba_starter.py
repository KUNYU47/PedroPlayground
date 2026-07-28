from pedro import *


def turn_right() -> None:
    """Turn Pedro 90 degrees clockwise by performing three left turns.

    Does not return a value.
    """
    # TODO: for i in range(3): turn_left()


def turn_around() -> None:
    """Turn Pedro 180 degrees to face the opposite direction.

    Does not return a value.
    """
    # TODO: 2 turn_left() calls


def left_is_clear() -> bool:
    """Return True if there is no wall to Pedro's immediate left.

    Pedro must end facing his original direction after checking.

    Returns:
        True if the cell to Pedro's left is empty, False if it is a wall.
    """
    # TODO: turn_left, check front_is_clear, turn_right (restore), return result


def clear_corner() -> None:
    """Remove any flag from the corner Pedro is standing on.

    Pre-condition:  The corner Pedro is on has 0 or 1 flags.
    Post-condition: The corner Pedro is on has zero flags.
    Does not return a value.
    """
    # TODO: if flag_present(), pick it up


def clear_row() -> None:
    """Clear an entire row of corners from left to right.

    Pre-condition:  Pedro is facing east at the start of the row.
    Post-condition: Pedro is at the end of a cleared row, facing east.
    Does not return a value.
    """
    # TODO: while front is clear: clear_corner, move forward
    #       Don't forget the fence post — clear the last corner too!


def move_to_wall() -> None:
    """Move Pedro forward until his front is blocked by a wall.

    Does not return a value.
    """
    # TODO: while front_is_clear(), move


def reset_to_next_row() -> None:
    """Move Pedro from the end of one row to the start of the next.

    Pre-condition:  Pedro is at the end of a row, facing east.
    Post-condition: Pedro is at the start of the next row, facing east.
    Does not return a value.
    """
    # TODO: turn_around, move_to_wall, turn_right, move, turn_right


def main() -> None:
    """Mission: Clear the world, row by row, using the Comb algorithm.

    Pedro sweeps rows from left to right, collecting flags, then
    resets to the next row. Left is clear until the top row is reached.
    """
    # TODO: while left_is_clear(): clear_row, reset_to_next_row
    #       FENCE POST: one more clear_row at the end


if __name__ == '__main__':
    main()
