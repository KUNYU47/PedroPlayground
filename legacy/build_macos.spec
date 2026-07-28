# -*- mode: python ; coding: utf-8 -*-
# macOS build: pyinstaller build_macos.spec
# Output: dist/PedroPlayground.app
from pathlib import Path

project_dir = Path(SPECPATH).absolute()

a = Analysis(
    [str(project_dir / 'main.py')],
    pathex=[str(project_dir)],
    binaries=[],
    datas=[
        (str(project_dir / 'pedro.py'), '.'),
        (str(project_dir / 'engine'), 'engine'),
        (str(project_dir / 'assets' / 'Astronaut-Sheet.png'), 'assets'),
        (str(project_dir / 'worlds'), 'worlds'),
        (str(project_dir / 'scaffolds'), 'scaffolds'),
    ],
    hiddenimports=[
        'PIL._tkinter_finder',
        'customtkinter',
        'engine',
        'engine.world',
        'engine.pedro_state',
        'engine.sprites',
        'engine.renderer',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='PedroPlayground',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

app = BUNDLE(
    exe,
    name='PedroPlayground.app',
    icon=None,
    bundle_identifier='com.jrdeepcoding.pedro',
    info_plist={
        'NSHighResolutionCapable': 'True',
        'LSMinimumSystemVersion': '10.13',
    },
)
