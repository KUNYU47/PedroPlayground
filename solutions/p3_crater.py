from pedro import *

def turn_right():
    turn_left()
    turn_left()
    turn_left()

def navigate_surface():
    flag_counter = 0
    while flag_counter < 4:
        if flag_present():
            pick_flag()
            flag_counter = flag_counter + 1
        if front_is_clear():
            move()
        else:
            navigate_crater_edge()

def navigate_crater_edge():
    turn_right()
    move()
    turn_left()
    move()
    move()
    turn_left()
    move()
    turn_right()

def main():
    navigate_surface()

if __name__ == '__main__':
    main()
