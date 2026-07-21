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

def collect_and_count() -> int:
    """
    Pick up all flags at Pedro's current position and return
    the total number collected. The number of flags is unknown.

    >>> collect_and_count()
    5
    """
    # TODO: count variable = 0
    # TODO: while flag_present(): pick_flag(), count += 1
    # TODO: return count

def navigate_to_pile() -> None:
    """
    Navigate Pedro to the top-left corner where the flag pile is.
    Pre: Pedro is somewhere in the world, facing east.
    Post: Pedro is at the top-left corner.

    >>> navigate_to_pile()
    >>> # Pedro is now at the top-left corner
    """
    # TODO: turn_left to face north, walk to the top wall
    # TODO: turn_left to face west, walk to the left wall

def navigate_to_base() -> None:
    """
    Navigate Pedro to the bottom-right corner where the base is.
    Pre: Pedro is somewhere in the world.
    Post: Pedro is at the bottom-right corner.

    >>> navigate_to_base()
    >>> # Pedro is now at the bottom-right corner
    """
    # TODO: turn_right to face down, walk to the bottom wall
    # TODO: turn_right to face right, walk to the right wall

def plant_flags(amount: int) -> None:
    """
    Plant exactly 'amount' flags at Pedro's current position.

    >>> plant_flags(3)
    >>> # Pedro planted 3 flags here
    """
    # TODO: for i in range(amount): plant_flag()

def main() -> None:
    """
    Mission: Navigate to the flag pile, collect and count the
    lunar core samples, then navigate to the research station
    and plant the samples there.
    """
    navigate_to_pile()
    total_samples = collect_and_count()
    navigate_to_base()
    plant_flags(total_samples)

if __name__ == '__main__':
    main()
