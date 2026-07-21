from pedro import *


def climb_up_mountain():
    while not front_is_clear():
        step_up()


def climb_down():
    while front_is_clear():
        step_down()


def step_up():
    turn_left()
    move()
    turn_right()
    move()


def step_down():
    move()
    turn_right()
    move()
    turn_left()


def turn_right():
    for i in range(3):
        turn_left()


def plant_apollo_flag():
    plant_flag()

def main():
    climb_up_mountain()
    plant_apollo_flag()
    climb_down()

if __name__ == '__main__':
    main()
