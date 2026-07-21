from pedro import *

def collect_and_count():
    flags_collected = 0
    while flag_present():
        pick_flag()
        flags_collected = flags_collected + 1
    return flags_collected

def travel_distance(distance):
    for i in range(distance):
        move()

def unload_samples(amount):
    for i in range(amount):
        plant_flag()

def main():
    total = collect_and_count()
    travel_distance(total)
    unload_samples(total)

if __name__ == '__main__':
    main()
