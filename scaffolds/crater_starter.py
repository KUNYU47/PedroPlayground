from pedro import *

def turn_right():
    """
    Turn Pedro 90 degrees clockwise using three left turns.
    """
    # TODO: Write 3 turn_left() calls

def navigate_crater_edge():
    """
    Pre:  Pedro's path is blocked by a crater edge.
    Post: Pedro has stepped around and over, facing east.
    """
    # TODO: 8 commands to go around the crater edge
    #       turn_right, move, turn_left, move, move,
    #       turn_left, move, turn_right

def navigate_surface():
    """
    Pre:  Pedro at start of row, facing east.
    Post: Pedro at far wall, facing east.
    """
    # TODO: Keep a counter of how many flags you've collected
    #       Use a while loop to continue until 4 flags are collected
    #       Inside: if there's a flag, pick it up and add to counter
    #               if front is clear, move forward
    #               if front is blocked, navigate the crater edge

def main():
    """
    Mission: Cross the lunar surface, collecting 4 flags and
    navigating around crater edges along the way.
    """
    navigate_surface()

if __name__ == '__main__':
    main()
