EMPTY = 0
WALL = 1
FLAG = 2

CELL_SYMBOLS = {
    '.': EMPTY,
    '#': WALL,
    'F': FLAG,
}

DIRECTION_SYMBOLS = {
    '^': 0,  # North
    '>': 1,  # East
    'v': 2,  # South
    '<': 3,  # West
}


class World:
    def __init__(self, grid):
        self._grid = grid
        self._rows = len(grid)
        self._cols = len(grid[0]) if grid else 0

    @property
    def rows(self):
        return self._rows

    @property
    def cols(self):
        return self._cols

    def get_cell(self, row, col):
        if 0 <= row < self._rows and 0 <= col < self._cols:
            return self._grid[row][col]
        return WALL

    def set_cell(self, row, col, value):
        if 0 <= row < self._rows and 0 <= col < self._cols:
            self._grid[row][col] = value

    def is_wall(self, row, col):
        return self.get_cell(row, col) == WALL

    def is_empty(self, row, col):
        return self.get_cell(row, col) == EMPTY

    def is_flag(self, row, col):
        return self.get_cell(row, col) == FLAG

    def place_flag(self, row, col):
        self.set_cell(row, col, FLAG)

    def remove_flag(self, row, col):
        cell = self.get_cell(row, col)
        if cell == FLAG:
            self.set_cell(row, col, EMPTY)
            return True
        return False


def parse_world(filepath):
    with open(filepath, 'r') as f:
        lines = [line.rstrip('\n\r') for line in f if line.strip()]

    if not lines:
        raise ValueError(f"World file is empty: {filepath}")

    max_cols = max(len(line) for line in lines)
    grid = []
    start_row = None
    start_col = None
    start_dir = 1

    for r, line in enumerate(lines):
        row = []
        for c in range(max_cols):
            ch = line[c] if c < len(line) else '#'
            if ch in DIRECTION_SYMBOLS:
                start_row = r
                start_col = c
                start_dir = DIRECTION_SYMBOLS[ch]
                row.append(EMPTY)
            else:
                row.append(CELL_SYMBOLS.get(ch, WALL))
        grid.append(row)

    if start_row is None:
        raise ValueError(f"No Pedro start position found in world file: {filepath}")

    return World(grid), start_row, start_col, start_dir
