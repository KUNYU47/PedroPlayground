from pedro import *

def walk_to_wall() -> None:
    """
    Move Pedro forward until he is facing a wall.
    Pre: front_is_clear() is True.
    Post: front_is_clear() is False (Pedro faces a wall).

    >>> walk_to_wall()
    >>> # Pedro is now at a wall, facing it
    """
    # TODO: while front_is_clear(), move()

def turn_right() -> None:
    """
    Turn Pedro 90 degrees clockwise using three left turns.

    >>> turn_right()
    >>> # Pedro has turned 90 degrees clockwise
    """
    # TODO: 3 turn_left() calls

def turn_around() -> None:
    """
    Turn Pedro 180 degrees around (two left turns).
    """
    # TODO: 2 turn_left() calls

def collect_and_count() -> int:
    """
    Pick up all flags at Pedro's current position and return
    the total number collected. The number of flags is unknown.

    >>> collect_and_count()
    5
    """
    # TODO: create a variable and set it to 0
    # TODO: while flag_present(): pick_flag(), increament the variable
    # TODO: return that variable

def navigate_to_top_left() -> None:
    """
    Navigate Pedro to the top-left corner of the world.
    Pre: Pedro is somewhere in the world, facing east.
    Post: Pedro is at the top-left corner, facing east.

    >>> navigate_to_top_left()
    >>> # Pedro is at the top-left corner
    """
    # TODO: turn_around, walk to left wall, turn right, walk to top wall, turn right

def navigate_to_flag() -> None:
    """
    Walk east until Pedro finds the flag pile.
    Pre: Pedro is at the top-left corner, facing east.
    Post: Pedro is on the flag pile.

    >>> navigate_to_flag()
    >>> # Pedro is at the flag pile
    """
    # TODO: while no flag present, move forward

def navigate_to_base() -> None:
    """
    Navigate Pedro to the bottom-right corner where the base is.
    Pre: Pedro is at the flag pile, facing east.
    Post: Pedro is at the bottom-right corner.

    >>> navigate_to_base()
    >>> # Pedro is at the base
    """
    # TODO: walk to right wall, turn right, walk to bottom wall

def plant_flags(amount: int) -> None:
    """
    Plant exactly 'amount' flags at Pedro's current position.

    >>> plant_flags(3)
    >>> # Pedro planted 3 flags here
    """
    # TODO: for i in range(how many iterations?): plant_flag()

def main() -> None:
    """
    Mission: Navigate to the flag pile, collect and count the
    lunar core samples, then navigate to the research station
    and plant the samples there.
    """
    navigate_to_top_left()
    navigate_to_flag()
    total_samples = collect_and_count()
    navigate_to_base()
    plant_flags(total_samples)

if __name__ == '__main__':
    main()
