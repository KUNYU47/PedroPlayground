from pedro import *

def turn_right():
    for i in range(3):
        turn_left()

def right_is_clear():
    turn_right()
    result = front_is_clear()
    turn_left()
    return result

def solve_maze():
    while not flag_present():
        if right_is_clear():
            turn_right()
            move()
        elif front_is_clear():
            move()
        else:
            turn_left()

def main():
    solve_maze()

if __name__ == '__main__':
    main()
