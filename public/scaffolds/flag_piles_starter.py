from pedro import *


def collect_one_pile() -> None:
    """Move forward through a pile of 3 flags, picking up each one.

    Pre-condition:  Pedro is one step before a pile of 3 flags in a row,
                    facing east.
    Post-condition: Pedro has passed through the pile and is standing
                    on the last flag's position, facing east.

    Returns:
        The number of flags collected from this pile (always 3).
    """
    # TODO: for loop (how many iterations?): move, pick_flag


def main() -> None:
    """Mission: There are 5 piles of flags across the surface.
    Each pile has 3 flags in a row. Pick up every flag.

    After each pile, step forward to approach the next pile.
    """
    # TODO: for loop (how many iterations?): collect_one_pile, move


if __name__ == '__main__':
    main()
