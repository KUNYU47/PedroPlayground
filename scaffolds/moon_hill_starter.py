from pedro import *

def turn_right():
    """
    Turn Pedro 90 degrees clockwise using three left turns.
    Works in any pre-condition state.
    """
    # TODO: 3 turn_left() calls

def step_up():
    """
    Pedro takes one step up the mountain.
    Pre-condition: Pedro is facing the mountain wall.
    Post-condition: Pedro is one step higher, facing east.
    """
    # TODO: exactly 4 commands — turn_left, move, turn_right, move

def step_down():
    """
    Pedro takes one step down the mountain.
    Pre-condition: Pedro is on a step, facing east.
    Post-condition: Pedro is one step lower, facing east.
    """
    # TODO: mirror of step_up — move, turn_right, move, turn_left
    
def climb_up_mountain():
    """
    Climb up the mountain until Pedro reaches the top.
    Post-condition: Pedro is at the top, facing east.
    """
    # TODO: while front is NOT clear, step up
    
def climb_down():
    """
    Climb down the mountain until Pedro reaches the bottom.
    Pre-condition: Pedro is at the top, facing east.
    Post-condition: Pedro is at the bottom, facing east.
    """
    # TODO: while front IS clear, step down

def plant_apollo_flag():
    """
    Plant the Apollo flag at Pedro's current position.
    """
    plant_flag()

def main():
    """
    Mission: Climb up the mountain, plant the flag,
    then climb down the other side.
    """
    climb_up_mountain()
    plant_apollo_flag()
    climb_down()

if __name__ == '__main__':
    main()
