# BROKEN: This code crashes! Can you find the bug?
# Pedro tries to move after planting the last flag and walks into the wall.
# This is an OFF-BY-ONE error — a classic fence post problem.
# Fix it below.

from pedro import *

def main():
    for i in range(5):
        plant_flag()
        move()

main()
