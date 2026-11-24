import logging
import os

from celery import Celery
from celery.signals import task_failure

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
app = Celery("pagamoz")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


@task_failure.connect
def _log_task_failure(sender=None, task_id=None, exception=None, **kw):
    logging.getLogger("pagamoz.tasks").error(
        "task failed",
        extra={"fields": {"task": getattr(sender, "name", "?"), "task_id": task_id, "error": repr(exception)}},
    )
