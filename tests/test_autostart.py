"""Inicio con Windows probado contra un registro falso en memoria (vale en cualquier sistema)."""

import pytest

from wallpaper_solar import autostart


class FakeWinreg:
    HKEY_CURRENT_USER = "HKCU"
    KEY_SET_VALUE = 2
    REG_SZ = 1

    def __init__(self):
        self.store = {}

    class _Key:
        def __init__(self, reg, path):
            self.reg, self.path = reg, path

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def OpenKey(self, root, path, *a):
        if path not in self.store:
            raise OSError("no existe")
        return self._Key(self, path)

    def CreateKeyEx(self, root, path, *a):
        self.store.setdefault(path, {})
        return self._Key(self, path)

    def QueryValueEx(self, key, name):
        try:
            return self.store[key.path][name], 1
        except KeyError:
            raise OSError("no existe") from None

    def SetValueEx(self, key, name, _r, _t, value):
        self.store[key.path][name] = value

    def DeleteValue(self, key, name):
        try:
            del self.store[key.path][name]
        except KeyError:
            raise OSError("no existe") from None


@pytest.fixture
def reg(monkeypatch):
    fake = FakeWinreg()
    monkeypatch.setattr(autostart, "winreg", fake)
    return fake


def test_enable_disable_roundtrip(reg):
    assert not autostart.is_enabled()
    assert autostart.enable()
    assert reg.store[autostart.RUN_KEY]["WallpaperSolar"] == autostart.launch_command()
    assert autostart.is_enabled()
    autostart.disable()
    assert not autostart.is_enabled()


def test_disabled_from_task_manager_counts_as_off_and_enable_clears_it(reg):
    autostart.enable()
    reg.store[autostart.APPROVED_KEY] = {"WallpaperSolar": bytes([3]) + bytes(11)}  # 0x03 = desactivada
    assert not autostart.is_enabled()
    autostart.enable()
    assert "WallpaperSolar" not in reg.store[autostart.APPROVED_KEY]
    assert autostart.is_enabled()


def test_task_manager_flag_parsing():
    assert autostart.is_disabled_in_task_manager(bytes([3, 0]))
    assert not autostart.is_disabled_in_task_manager(bytes([2, 0]))
    assert not autostart.is_disabled_in_task_manager(None)


def test_dev_command_uses_pythonw_and_run_py():
    cmd = autostart.launch_command()
    assert cmd.endswith('run.py"')
    assert cmd.count('"') == 4


def test_dev_mode_never_rewrites_existing_entry(reg):
    reg.store[autostart.RUN_KEY] = {"WallpaperSolar": '"C:\\Program\\WallpaperSolar.exe"'}
    autostart.refresh_command_if_enabled()
    assert reg.store[autostart.RUN_KEY]["WallpaperSolar"] == '"C:\\Program\\WallpaperSolar.exe"'
