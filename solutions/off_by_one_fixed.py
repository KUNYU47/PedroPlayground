# FIXED: The fence post pattern.
# 5 corners need 4 moves. Plant-and-move for n-1 corners,
# then one final plant for the last corner.
# This is the FENCE POST SOLUTION.

from pedro import *

def main():
    for i in range(4):
        plant_flag()
        move()
    plant_flag()  # The last post!

main()
