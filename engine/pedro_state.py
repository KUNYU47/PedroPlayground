from engine.world import BASE

DIRECTION_DELTAS = {
    0: (-1, 0),   # North: row - 1
    1: (0, 1),    # East:  col + 1
    2: (1, 0),    # South: row + 1
    3: (0, -1),   # West:  col - 1
}


class PedroError(Exception):
    pass


class PedroState:
    def __init__(self, world, start_row, start_col, start_dir):
        self._world = world
        self._row = start_row
        self._col = start_col
        self._dir = start_dir
        self._flags = 0
        self._snapshots = []
        self._total_picked_up = 0
        self._flags_planted_at_base = 0

    @property
    def row(self):
        return self._row

    @property
    def col(self):
        return self._col

    @property
    def direction(self):
        return self._dir

    @property
    def flags_carried(self):
        return self._flags

    @property
    def world(self):
        return self._world

    def get_snapshots(self):
        return self._snapshots

    def is_base_verified(self):
        return self._flags_planted_at_base == self._total_picked_up

    def get_expected_flags(self):
        return self._total_picked_up

    def get_planted_at_base(self):
        return self._flags_planted_at_base

    def _front_row_col(self):
        dr, dc = DIRECTION_DELTAS[self._dir]
        return self._row + dr, self._col + dc

    def move(self):
        nr, nc = self._front_row_col()
        if self._world.is_wall(nr, nc):
            raise PedroError(f"Pedro cannot move: wall at ({nr}, {nc})")
        self._row = nr
        self._col = nc
        self._record('move')

    def turn_left(self):
        self._dir = (self._dir - 1) % 4
        self._record('turn_left')

    def plant_flag(self):
        if self._world.get_cell(self._row, self._col) == BASE:
            self._flags_planted_at_base += 1
        self._world.place_flag(self._row, self._col)
        self._record('plant_flag')

    def pick_flag(self):
        if not self._world.is_flag(self._row, self._col):
            raise PedroError(f"Pedro cannot pick flag: no flag at ({self._row}, {self._col})")
        self._world.remove_flag(self._row, self._col)
        self._flags += 1
        self._total_picked_up += 1
        self._record('pick_flag')

    def flag_present(self):
        return self._world.is_flag(self._row, self._col)

    def front_is_clear(self):
        nr, nc = self._front_row_col()
        return not self._world.is_wall(nr, nc)

    def flag_present(self):
        return self._dir == 0

    def facing_east(self):
        return self._dir == 1

    def _record(self, action):
        grid_copy = [row[:] for row in self._world._grid]
        self._snapshots.append({
            'action': action,
            'row': self._row,
            'col': self._col,
            'direction': self._dir,
            'flags_carried': self._flags,
            'grid': grid_copy,
        })
