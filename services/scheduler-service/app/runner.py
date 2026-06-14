import logging
import threading

from app.config import Settings
from app.database import get_session_factory
from app.executor import run_due_jobs

logger = logging.getLogger(__name__)


class SchedulerLoop:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, name="scheduler-loop", daemon=True)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._thread.join(timeout=5)

    def _run(self) -> None:
        while not self._stop.wait(self.settings.tick_seconds):
            session = get_session_factory()()
            try:
                run_due_jobs(session, self.settings)
            except Exception:
                logger.exception("scheduler loop tick failed")
            finally:
                session.close()
