from engine.world import parse_world, World, WALL, BASE
from engine.sprites import SpriteManager
from PIL import ImageTk

CELL_SIZE = 48
CELL_SIZE_MIN = 24
CELL_SIZE_MAX = 96
CELL_SIZE_STEP = 8
WALL_COLOR = "#505050"
EMPTY_COLOR = "#E8E0D0"
FLAG_COLOR = "#E04040"
GRID_LINE_COLOR = "#C0B8A8"


class GridRenderer:
    def __init__(self, canvas, sprite_manager):
        self._canvas = canvas
        self._sprites = sprite_manager
        self._cell_size = CELL_SIZE
        self._world = None
        self._world_path = None
        self._pedro_row = 0
        self._pedro_col = 0
        self._pedro_dir = 1
        self._flags_carried = 0
        self._photo_refs = []
        self._pedro_image_id = None

    def load_world(self, filepath):
        self._world_path = filepath
        self._world, sr, sc, sd = parse_world(filepath)
        self._pedro_row = sr
        self._pedro_col = sc
        self._pedro_dir = sd
        self._flags_carried = 0
        self._photo_refs.clear()
        self._pedro_image_id = None
        self._draw_grid()

    def zoom_in(self):
        self._cell_size += CELL_SIZE_STEP
        self._reload()

    def zoom_out(self):
        if self._cell_size > CELL_SIZE_STEP:
            self._cell_size -= CELL_SIZE_STEP
            self._reload()

    def _reload(self):
        if self._world_path:
            self.load_world(self._world_path)

    def _sprite_scale(self):
        return max(1, self._cell_size // 16)

    def _pil_to_tk(self, pil_image):
        photo = ImageTk.PhotoImage(pil_image)
        self._photo_refs.append(photo)
        return photo

    def _draw_grid(self):
        self._canvas.delete("all")
        self._photo_refs.clear()
        self._pedro_image_id = None

        w = self._world
        rows = w.rows
        cols = w.cols
        cs = self._cell_size

        canvas_w = cols * cs
        canvas_h = rows * cs
        self._canvas.config(width=canvas_w, height=canvas_h)

        for r in range(rows):
            for c in range(cols):
                x1 = c * cs
                y1 = r * cs
                x2 = x1 + cs
                y2 = y1 + cs

                cell = w.get_cell(r, c)
                fill = WALL_COLOR if cell == WALL else EMPTY_COLOR
                self._canvas.create_rectangle(x1, y1, x2, y2,
                                              fill=fill, outline=GRID_LINE_COLOR, width=1)
                if cell == BASE:
                    cx, cy = c * cs + cs//2, r * cs + cs//2
                    s = cs // 3
                    self._canvas.create_rectangle(cx - s, cy - s, cx + s, cy + s,
                                                   fill="#4488CC", outline="#225577")
                    self._canvas.create_text(cx, cy, text="B", font=("", max(8, cs//3)),
                                              fill="#FFFFFF")
                elif cell >= 2:
                    self._draw_flag(c, r, cs)
                    if cell > 2:
                        cx = c * cs + cs//2
                        cy = r * cs + cs//2 + 2
                        count = cell - 1
                        self._canvas.create_text(cx, cy, text=str(count),
                                                  font=("", max(8, cs//3)),
                                                  fill="#FFFFFF", anchor="center")

        self._draw_pedro()

    def _draw_flag(self, col, row, cs):
        cx = col * cs + cs // 2
        cy = row * cs + cs // 2
        size = cs // 3
        points = [cx - size, cy + size // 2, cx, cy - size // 2,
                  cx + size, cy + size // 2]
        self._canvas.create_polygon(points, fill=FLAG_COLOR, outline="#B03030", width=1)
        self._canvas.create_line(cx, cy + size // 2, cx, cy + size // 2 + size // 2,
                                 fill="#666666", width=2)

    def _draw_pedro(self):
        pil_img = self._sprites.get_pil_idle(self._pedro_dir, self._sprite_scale())
        tk_img = self._pil_to_tk(pil_img)
        x = self._pedro_col * self._cell_size + self._cell_size // 2
        y = self._pedro_row * self._cell_size + self._cell_size // 2
        new_id = self._canvas.create_image(x, y, image=tk_img, anchor="center")
        if self._pedro_image_id:
            self._canvas.delete(self._pedro_image_id)
        self._pedro_image_id = new_id

    def _draw_pedro_with_frame(self, pil_frame, row, col):
        tk_img = self._pil_to_tk(pil_frame)
        x = col * self._cell_size + self._cell_size // 2
        y = row * self._cell_size + self._cell_size // 2
        new_id = self._canvas.create_image(x, y, image=tk_img, anchor="center")
        if self._pedro_image_id:
            self._canvas.delete(self._pedro_image_id)
        self._pedro_image_id = new_id

    def apply_snapshot(self, snapshot):
        self._world = World(snapshot['grid'])
        self._pedro_row = snapshot['row']
        self._pedro_col = snapshot['col']
        self._pedro_dir = snapshot['direction']
        self._flags_carried = snapshot.get('flags_carried', 0)
        self._draw_grid()

    def animate_action(self, snapshot, callback=None, fps=8):
        action = snapshot['action']
        target_row = snapshot['row']
        target_col = snapshot['col']
        target_dir = snapshot['direction']
        target_grid = snapshot['grid']

        if action == 'move':
            frames = self._sprites.get_pil_frames('move', self._pedro_dir, self._sprite_scale())
            self._animate_move(frames, self._pedro_row, self._pedro_col,
                               target_row, target_col, target_dir,
                               target_grid, 0, fps, callback)
        elif action == 'turn_left':
            frames = self._sprites.get_pil_frames('turn_left', self._pedro_dir, self._sprite_scale())
            self._animate_turn(frames, target_dir, target_grid, 0, fps, callback)
        elif action == 'turn_right':
            frames = self._sprites.get_pil_frames('turn_left', self._pedro_dir, self._sprite_scale())
            self._animate_turn(frames, target_dir, target_grid, 0, fps, callback)
        else:
            frames = self._sprites.get_pil_frames(action, self._pedro_dir, self._sprite_scale())
            self._animate_action(frames, target_row, target_col, target_dir,
                                 target_grid, 0, fps, callback)

    def _animate_move(self, frames, sr, sc, tr, tc, td, grid, idx, fps, cb):
        if idx >= len(frames):
            self._world = World(grid)
            self._pedro_row = tr
            self._pedro_col = tc
            self._pedro_dir = td
            self._draw_pedro()
            if cb:
                cb()
            return

        t = idx / max(len(frames) - 1, 1)
        cr = sr + (tr - sr) * t
        cc = sc + (tc - sc) * t
        self._draw_pedro_with_frame(frames[idx], cr, cc)

        delay = int(1000 / fps)
        self._canvas.after(delay, lambda: self._animate_move(
            frames, sr, sc, tr, tc, td, grid, idx + 1, fps, cb))

    def _animate_turn(self, frames, target_dir, grid, idx, fps, cb):
        if idx >= len(frames):
            self._world = World(grid)
            self._pedro_dir = target_dir
            self._draw_pedro()
            if cb:
                cb()
            return

        self._draw_pedro_with_frame(frames[idx], self._pedro_row, self._pedro_col)

        delay = int(1000 / fps)
        self._canvas.after(delay, lambda: self._animate_turn(
            frames, target_dir, grid, idx + 1, fps, cb))

    def _animate_action(self, frames, tr, tc, td, grid, idx, fps, cb):
        if idx >= len(frames):
            self._world = World(grid)
            self._pedro_row = tr
            self._pedro_col = tc
            self._pedro_dir = td
            self._draw_grid()
            if cb:
                cb()
            return

        self._draw_grid()
        self._draw_pedro_with_frame(frames[idx], tr, tc)

        delay = int(1000 / fps)
        self._canvas.after(delay, lambda: self._animate_action(
            frames, tr, tc, td, grid, idx + 1, fps, cb))
