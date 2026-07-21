from pedro import *


def clear_row():
    while front_is_clear():
        clear_corner()
        move()
    clear_corner()


def clear_corner():
    if flag_present():
        pick_flag()


def reset_to_next_row():
    turn_around()
    move_to_wall()
    turn_right()
    move()
    turn_right()


def move_to_wall():
    while front_is_clear():
        move()


def left_is_clear():
    turn_left()
    result = front_is_clear()
    turn_right()
    return result


def turn_right():
    for i in range(3):
        turn_left()


def turn_around():
    turn_left()
    turn_left()

def main():
    while left_is_clear():
        clear_row()
        reset_to_next_row()
    clear_row()

if __name__ == '__main__':
    main()
