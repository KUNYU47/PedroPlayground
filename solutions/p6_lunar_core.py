from pedro import *

def walk_to_wall() -> None:
    """
    Move Pedro forward until he is facing a wall.
    Pre: front_is_clear() is True.
    Post: front_is_clear() is False (Pedro faces a wall).

    >>> walk_to_wall()
    >>> # Pedro is now at a wall, facing it
    """
    while front_is_clear():
        move()

def turn_right() -> None:
    """
    Turn Pedro 90 degrees clockwise using three left turns.

    >>> turn_right()
    >>> # Pedro has turned 90 degrees clockwise
    """
    for i in range(3):
        turn_left()

def collect_and_count() -> int:
    """
    Pick up all flags at Pedro's current position and return
    the total number collected.

    >>> collect_and_count()
    5
    """
    flags_collected = 0
    while flag_present():
        pick_flag()
        flags_collected = flags_collected + 1
    return flags_collected

def navigate_to_pile() -> None:
    """
    Navigate Pedro to the top-left corner where the flag pile is.
    """
    turn_left()
    walk_to_wall()
    turn_left()
    walk_to_wall()

def navigate_to_base() -> None:
    """
    Navigate Pedro to the bottom-right corner where the base is.
    """
    turn_right()
    walk_to_wall()
    turn_right()
    walk_to_wall()

def plant_flags(amount: int) -> None:
    """
    Plant exactly 'amount' flags at Pedro's current position.

    >>> plant_flags(3)
    >>> # Pedro planted 3 flags here
    """
    for i in range(amount):
        plant_flag()

def main() -> None:
    navigate_to_pile()
    total_samples = collect_and_count()
    navigate_to_base()
    plant_flags(total_samples)

if __name__ == '__main__':
    main()
