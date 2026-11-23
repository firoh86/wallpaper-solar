import json

import pytest

from wallpaper_solar import settings as st


@pytest.fixture(autouse=True)
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("WALLPAPER_DATA_DIR", str(tmp_path))
    return tmp_path


def test_defaults_when_missing():
    s = st.Settings.load()
    assert s.interactive_mode is True and s.hud_visible is True


def test_roundtrip(data_dir):
    st.save_settings(st.Settings(interactive_mode=False, hud_visible=False))
    assert json.loads((data_dir / "settings.json").read_text(encoding="utf-8")) == {
        "interactive_mode": False,
        "hud_visible": False,
    }
    s = st.Settings.load()
    assert s.interactive_mode is False and s.hud_visible is False
    assert not list(data_dir.glob(".settings-*"))  # no quedan temporales


def test_corrupt_or_foreign_values_fall_back_to_defaults(data_dir):
    (data_dir / "settings.json").write_text("{esto no es json", encoding="utf-8")
    assert st.Settings.load() == st.Settings()
    raw = '{"hud_visible": "no", "otra": 1, "interactive_mode": false}'
    (data_dir / "settings.json").write_text(raw, encoding="utf-8")
    s = st.Settings.load()
    assert s.hud_visible is True  # tipo incorrecto: se ignora
    assert s.interactive_mode is False


def test_all_data_lives_in_one_folder(data_dir):
    assert st.logs_dir().parent == data_dir
    assert st.webview_storage_dir().parent == data_dir
    assert st.settings_file().parent == data_dir


def test_close_log_files_releases_the_log(data_dir):
    from wallpaper_solar import log

    log._configured = False
    log.setup_logging()
    log.logger.info("hola")
    file_handlers = [h for h in log.logger.handlers if hasattr(h, "baseFilename")]
    assert file_handlers, "debería escribir en logs/wallpaper.log"
    log.close_log_files()
    assert all(h.stream is None for h in file_handlers)  # archivo cerrado: el desinstalador puede borrarlo
    assert not any(hasattr(h, "baseFilename") for h in log.logger.handlers)
    log.logger.info("esto ya no se escribe ni falla")
    assert (data_dir / "logs" / "wallpaper.log").read_text(encoding="utf-8").count("hola") == 1
