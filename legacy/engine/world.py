EMPTY = 0
WALL = 1
BASE = -1

CELL_SYMBOLS = {
    '.': 0, '#': 1, 'F': 2, 'B': BASE,
    '2': 3, '3': 4, '4': 5, '5': 6, '6': 7, '7': 8, '8': 9, '9': 10,
}

DIRECTION_SYMBOLS = {
    '^': 0,  '>': 1,  'v': 2,  '<': 3,
}


def generate_maze(rows, cols):
    import random
    from collections import deque

    rows = max(5, rows)
    cols = max(5, cols)
    if rows % 2 == 0:
        rows += 1
    if cols % 2 == 0:
        cols += 1

    grid = [['#' for _ in range(cols)] for _ in range(rows)]

    start_r, start_c = 1, 1
    grid[start_r][start_c] = '.'
    stack = [(start_r, start_c)]
    visited = {(start_r, start_c)}
    directions = [(-2, 0), (2, 0), (0, -2), (0, 2)]

    while stack:
        cr, cc = stack[-1]
        random.shuffle(directions)
        carved = False
        for dr, dc in directions:
            nr, nc = cr + dr, cc + dc
            if 1 <= nr < rows - 1 and 1 <= nc < cols - 1 and (nr, nc) not in visited:
                mr, mc = cr + dr // 2, cc + dc // 2
                grid[mr][mc] = '.'
                grid[nr][nc] = '.'
                visited.add((nr, nc))
                stack.append((nr, nc))
                carved = True
                break
        if not carved:
            stack.pop()

    candidates = [(r, c) for r in range(1, rows - 1)
                  for c in range(1, cols - 1) if grid[r][c] == '.']
    pedro_pos = random.choice(candidates)

    q = deque([pedro_pos])
    dist = {pedro_pos: 0}
    while q:
        cr, cc = q.popleft()
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = cr + dr, cc + dc
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == '.' and (nr, nc) not in dist:
                dist[(nr, nc)] = dist[(cr, cc)] + 1
                q.append((nr, nc))
    goal_pos = max(dist, key=dist.get)

    pr, pc = pedro_pos
    gr, gc = goal_pos
    grid[pr][pc] = '>'
    grid[gr][gc] = 'F'

    return grid, pr, pc, 1, gr, gc


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

    def is_flag(self, row, col):
        return self.get_cell(row, col) >= 2

    def flag_count(self, row, col):
        v = self.get_cell(row, col)
        return max(0, v - 1) if v >= 2 else 0

    def place_flag(self, row, col):
        v = self.get_cell(row, col)
        if v == EMPTY:
            self.set_cell(row, col, 2)
        elif v >= 2:
            self.set_cell(row, col, v + 1)

    def remove_flag(self, row, col):
        v = self.get_cell(row, col)
        if v >= 2:
            if v == 2:
                self.set_cell(row, col, EMPTY)
            else:
                self.set_cell(row, col, v - 1)
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
        c = 0
        while c < max_cols:
            ch = line[c] if c < len(line) else '#'
            if ch in DIRECTION_SYMBOLS:
                start_row = r
                start_col = c
                start_dir = DIRECTION_SYMBOLS[ch]
                digits = ''
                cc = c + 1
                while cc < len(line) and line[cc].isdigit():
                    digits += line[cc]
                    cc += 1
                if digits:
                    count = int(digits)
                    row.append(count + 1 if count >= 1 else EMPTY)
                    c = cc - 1
                else:
                    row.append(EMPTY)
            else:
                row.append(CELL_SYMBOLS.get(ch, WALL))
            c += 1
        while len(row) < max_cols:
            row.append(WALL)
        grid.append(row)

    if start_row is None:
        raise ValueError(f"No Pedro start position found in world file: {filepath}")

    return World(grid), start_row, start_col, start_dir
