from PIL import Image

FRAME_SIZE = 16
COLS = 14

ANIMATION_ROWS = {
    'idle': 0,
    'move': 1,
    'turn_left': 2,
    'plant_flag': 3,
    'pick_flag': 3,
}

DIRECTION_ANGLES = {
    0: 90,    # North
    1: 0,     # East
    2: 270,   # South
    3: 180,   # West
}


class SpriteManager:
    def __init__(self, filepath, scale=3):
        self._sheet = Image.open(filepath).convert('RGBA')
        self._scale = scale
        self._pil_cache = {}

    def get_pil_frames(self, action, direction, scale=None):
        if scale is None:
            scale = self._scale
        key = (action, direction, scale)
        if key in self._pil_cache:
            return self._pil_cache[key]

        row = ANIMATION_ROWS.get(action, 0)
        frames = []
        display_size = FRAME_SIZE * scale
        for col in range(COLS):
            x = col * FRAME_SIZE
            y = row * FRAME_SIZE
            frame = self._sheet.crop((x, y, x + FRAME_SIZE, y + FRAME_SIZE))
            if direction != 1:
                frame = frame.rotate(DIRECTION_ANGLES[direction], expand=True)
            frame = frame.resize((display_size, display_size), Image.NEAREST)
            frames.append(frame)

        self._pil_cache[key] = frames
        return frames

    def get_pil_idle(self, direction, scale=None):
        return self.get_pil_frames('idle', direction, scale)[0]
