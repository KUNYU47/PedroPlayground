from pedro import *

def turn_right():
    turn_left()
    turn_left()
    turn_left()

def turn_around():
    turn_left()
    turn_left()

def main():
    for i in range(20):
        plant_flag()
        move()

    turn_around()
    for i in range(20):
        move()

    turn_around()
    turn_right()
    move()
    turn_left()

    for i in range(26):
        plant_flag()
        move()

if __name__ == '__main__':
    main()
