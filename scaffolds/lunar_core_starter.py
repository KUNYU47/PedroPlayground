from pedro import *

def collect_and_count():
    """
    Return the number of flags collected at Pedro's current position.
    Picks up ALL flags here and returns how many were collected.
    The number of flags is unknown — you cannot hard-code a number.
    """
    # TODO: Use a variable to count flags
    # TODO: Use a while loop: while flag_present(), pick_flag(), add to counter
    # TODO: Return the count

def travel_distance(distance):
    """
    Move Pedro forward exactly 'distance' steps.
    Pre: distance is the number of steps to move.
    Post: Pedro has moved forward distance times.
    """
    # TODO: Use a for loop with range(distance)

def unload_samples(amount):
    """
    Plant exactly 'amount' flags at Pedro's current position.
    Pre: amount is the number of flags to plant.
    Post: amount flags have been planted here.
    """
    # TODO: Use a for loop with range(amount)

def main():
    """
    Mission: Collect all flags at the starting position,
    count them, walk that many steps forward, then plant
    the same number of flags at the destination.
    """
    # TODO: Call collect_and_count, store the result in a variable
    # TODO: Pass that variable to travel_distance
    # TODO: Pass that variable to unload_samples

if __name__ == '__main__':
    main()
