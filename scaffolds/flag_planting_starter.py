from pedro import *


def turn_right() -> None:
    """Turn Pedro 90 degrees clockwise by performing three left turns.

    Does not return a value.
    """
    # TODO: Write 3 turn_left() calls


def turn_around() -> None:
    """Turn Pedro 180 degrees to face the opposite direction.

    Does not return a value.
    """
    # TODO: 2 turn_left() calls


def plant_first_row() -> None:
    """Plant 20 flags in a row while moving forward.

    Pre-condition:  Pedro is at the start of the first row, facing east.
    Post-condition: Pedro is at the end of the row with 20 flags planted.
    Does not return a value.
    """
    # TODO: for loop (how many iterations?): plant_flag, move


def return_to_start() -> None:
    """Move back 20 steps to return to the start of the first row.

    Pre-condition:  Pedro is at the end of the first row, facing east.
    Post-condition: Pedro is back at the start, facing east.
    Does not return a value.
    """
    # TODO: turn_around, for loop (20 iterations): move, turn_around


def move_to_second_row() -> None:
    """Move Pedro down to the second row, facing east.

    Pre-condition:  Pedro is at the start of row 1, facing east.
    Post-condition: Pedro is at the start of row 2, facing east.
    Does not return a value.
    """
    # TODO: turn_right, move, turn_left


def plant_second_row() -> None:
    """Plant 26 flags in a row while moving forward on the second row.

    Pre-condition:  Pedro is at the start of the second row, facing east.
    Post-condition: Pedro is at the end of the row with 26 flags planted.
    Does not return a value.
    """
    # TODO: for loop (how many iterations?): plant_flag, move


def main() -> None:
    """Mission: Plant 20 flags in a row, return to start, move down
    to the second row, then plant 26 flags — totalling 2026 flags
    to celebrate the year 2026.
    """
    plant_first_row()
    return_to_start()
    move_to_second_row()
    plant_second_row()


if __name__ == '__main__':
    main()
