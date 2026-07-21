from pedro import *

def turn_right():
    """
    Turn Pedro 90 degrees clockwise using three left turns.
    """
    # TODO: for i in range(3): turn_left()

def turn_around():
    """
    Turn Pedro 180 degrees to face the opposite direction.
    """
    # TODO: 2 turn_left() calls

def left_is_clear():
    """
    Return True if there is no wall to Pedro's left.
    """
    # TODO: turn_left, check front_is_clear, turn_right (restore), return result

def clear_corner():
    """
    Clean a corner so there are no flags on it.
    Pre:  The corner Pedro is on has 0 or 1 flags.
    Post: The corner Pedro is on has zero flags.
    """
    # TODO: if flag_present(), pick it up
    
def clear_row():
    """
    Clear an entire row.
    Pre:  Pedro is facing east at the start of the row.
    Post: Pedro is at the end of a cleared row, facing east.
    """
    # TODO: while front is clear: clear corner, move forward
    #       Don't forget the fence post at the end!

def move_to_wall():
    """
    Move Pedro forward until he is facing a wall.
    """
    # TODO: while front_is_clear(), move

def reset_to_next_row():
    """
    Pre:  Pedro is at the end of a row, facing east.
    Post: Pedro is at the start of the next row, facing east.
    """
    # TODO: turn_around, move_to_wall, turn_right, move, turn_right

def main():
    """
    Clear the world, row by row, using the Comb algorithm.
    Left is clear until you are on the top row.
    """
    # TODO: while left_is_clear: clear_row, reset_to_next_row
    #       FENCE POST: one more clear_row at the end

if __name__ == '__main__':
    main()
