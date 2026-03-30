import os
import glob
import time
import subprocess
from collections import deque

# The decky plugin module is located at decky-loader/plugin
# For easy intellisense checkout the decky-loader code repo
# and add the `decky-loader/plugin/imports` path to `python.analysis.extraPaths` in `.vscode/settings.json`
import decky
import asyncio


class LightHistoryWindow:
    def __init__(self, window_seconds: int = 120):
        self.window_seconds = window_seconds
        self._samples = deque()

    def add(self, value: int) -> None:
        now = time.time()
        self._samples.append((now, value))
        self._prune(now)

    def to_dict(self) -> dict[int, int]:
        # Use integer seconds for lightweight JSON-friendly keys.
        return {int(ts): value for ts, value in self._samples}

    def _prune(self, now: float) -> None:
        cutoff = now - self.window_seconds
        while self._samples and self._samples[0][0] < cutoff:
            self._samples.popleft()
            
    def get_average_last_n_seconds(self, n: int) -> float:
        cutoff = time.time() - n
        relevant_samples = [value for ts, value in self._samples if ts >= cutoff]
        if not relevant_samples:
            return 0.0
        return sum(relevant_samples) / len(relevant_samples)

class Plugin:
    def __init__(self):
        # A switch to control globally.
        self.is_enabled = True
        # The task running the long-running process.
        self.worker_task = None
        # Keeps the most recent 2 minutes of light samples.
        self.light_history = LightHistoryWindow(window_seconds=120)
    
    
    async def set_enabled(self, enabled: bool) -> bool:
        self.is_enabled = enabled
        decky.logger.info(f"Plugin enabled set to {enabled}")
        return self.is_enabled
    
    async def get_enabled_state(self) -> bool:
        decky.logger.info(f"Plugin enabled state is {self.is_enabled}")
        return self.is_enabled

    async def get_light_history(self) -> dict[int, int]:
        return self.light_history.to_dict()
    
    # Read the value of the light sensor and return it. 
    async def get_light_value(self) -> int:
        try:
            sensor_path = glob.glob("/sys/bus/iio/devices/iio:device*/in_illuminance_raw")
            if not sensor_path:
                decky.logger.error("Light sensor not found")
                return -1
            
            with open(sensor_path[0], "r") as f:
                value = int(f.read().strip())
                decky.logger.info(f"Light sensor value: {value}")
                return value
        except Exception as e:
            decky.logger.error(f"Error reading light sensor: {e}")
            return -1
        
    async def get_light_average_last_5_seconds(self) -> float:
        return self.light_history.get_average_last_n_seconds(5)
    
    async def should_suspend(self) -> bool:
        if not self.is_enabled:
            return False
        avg = self.light_history.get_average_last_n_seconds(5)
        # If average is valid and below 5, it's dark enough to sleep
        if avg != -1.0 and avg < 5:
            decky.logger.info(f"Suspend triggered! 5-sec average is: {avg}")
            return True
            
        return False

    async def long_running(self):
        decky.logger.info("Long running task started")
        try:
            while True:
                if self.is_enabled:
                    light = await self.get_light_value()
                    self.light_history.add(light)
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            decky.logger.info("Long running task cancelled")
            raise

    # Asyncio-compatible long-running code, executed in a task when the plugin is loaded
    async def _main(self):
        self.loop = asyncio.get_event_loop()
        self.worker_task = self.loop.create_task(self.long_running())
        decky.logger.info("Pocket Protector Backend Started!")

    # Function called first during the unload process, utilize this to handle your plugin being stopped, but not
    # completely removed
    async def _unload(self):
        if self.worker_task is not None:
            self.worker_task.cancel()
            try:
                await self.worker_task
            except asyncio.CancelledError:
                pass
        decky.logger.info("Pocket Protector Backend Stopped!")

    # Function called after `_unload` during uninstall, utilize this to clean up processes and other remnants of your
    # plugin that may remain on the system
    async def _uninstall(self):
        decky.logger.info("Pocket Protector Backend Uninstalled!")
        pass

    # Migrations that should be performed before entering `_main()`.
    async def _migration(self):
        pass
        # decky.logger.info("Migrating")
        # # Here's a migration example for logs:
        # # - `~/.config/decky-template/template.log` will be migrated to `decky.decky_LOG_DIR/template.log`
        # decky.migrate_logs(os.path.join(decky.DECKY_USER_HOME,
        #                                        ".config", "decky-template", "template.log"))
        # # Here's a migration example for settings:
        # # - `~/homebrew/settings/template.json` is migrated to `decky.decky_SETTINGS_DIR/template.json`
        # # - `~/.config/decky-template/` all files and directories under this root are migrated to `decky.decky_SETTINGS_DIR/`
        # decky.migrate_settings(
        #     os.path.join(decky.DECKY_HOME, "settings", "template.json"),
        #     os.path.join(decky.DECKY_USER_HOME, ".config", "decky-template"))
        # # Here's a migration example for runtime data:
        # # - `~/homebrew/template/` all files and directories under this root are migrated to `decky.decky_RUNTIME_DIR/`
        # # - `~/.local/share/decky-template/` all files and directories under this root are migrated to `decky.decky_RUNTIME_DIR/`
        # decky.migrate_runtime(
        #     os.path.join(decky.DECKY_HOME, "template"),
        #     os.path.join(decky.DECKY_USER_HOME, ".local", "share", "decky-template"))
