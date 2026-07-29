# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the Pedro Playground launcher (Windows).

Bundles launch.py together with the pre-built frontend (dist/) into a
single-file executable. The exe serves dist/ over http and opens the
browser; user-customizable worlds/ and scaffolds/ folders are created
next to the exe on first run.

Build (on Windows, or via .github/workflows/build-windows.yml):
    npm run build
    pyinstaller build_windows.spec --noconfirm
"""
from pathlib import Path

project_dir = Path(SPECPATH).absolute()

a = Analysis(
    [str(project_dir / 'launch.py')],
    pathex=[str(project_dir)],
    binaries=[],
    datas=[
        (str(project_dir / 'dist'), 'dist'),
    ],
    hiddenimports=[],
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
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
