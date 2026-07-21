from pedro import *

def walk_to_wall() -> None:
    """
    Move Pedro forward until he is facing a wall.
    Pre: front_is_clear() is True.
    Post: front_is_clear() is False (Pedro faces a wall).
    """
    while front_is_clear():
        move()

def turn_right() -> None:
    """
    Turn Pedro 90 degrees clockwise using three left turns.
    """
    for i in range(3):
        turn_left()

def turn_around() -> None:
    turn_left()
    turn_left()

def collect_and_count() -> int:
    """
    Pick up all flags at Pedro's current position and return
    the total number collected. The number of flags is unknown.
    """
    result = 0
    while flag_present():
        pick_flag()
        result = result + 1
    return result

def navigate_to_top_left() -> None:
    """
    Navigate Pedro to the top-left corner of the world.
    """
    turn_around()
    walk_to_wall()
    turn_right()
    walk_to_wall()
    turn_right()

def navigate_to_flag() -> None:
    """
    Walk east until Pedro finds the flag pile.
    """
    while not flag_present():
        move()

def navigate_to_base() -> None:
    """
    Navigate Pedro to the bottom-right corner where the base is.
    """
    walk_to_wall()
    turn_right()
    walk_to_wall()

def plant_flags(amount: int) -> None:
    """
    Plant exactly 'amount' flags at Pedro's current position.
    """
    for i in range(amount):
        plant_flag()

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
