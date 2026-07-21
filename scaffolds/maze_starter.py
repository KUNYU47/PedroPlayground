from pedro import *

def turn_right():
    """
    Turn Pedro 90 degrees to the right using three left turns.
    """
    # TODO: 3 turn_left() calls

def right_is_clear():
    """
    Return True if there is no wall to Pedro's right.
    Pedro must return to his original facing direction.
    """
    # TODO: turn_right, check front_is_clear, store result in variable
    # TODO: turn_left to restore original direction
    # TODO: return the result

def solve_maze():
    """
    Navigate the maze using the Right-Hand Rule until Pedro
    finds the exit (a flag).
    Keep your right hand on the wall at all times.
    """
    # TODO: while no flag is present:
    #   if right_is_clear(): turn_right(); move()
    #   elif front_is_clear(): move()
    #   else: turn_left()

def main():
    """
    Mission: Escape the maze using the Right-Hand Rule.
    """
    solve_maze()

if __name__ == '__main__':
    main()
