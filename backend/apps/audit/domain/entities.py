from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class AuditEvent:
    module: str
    action: str
    occurred_at: datetime
    resource_type: str = ""
    resource_id: str = ""
    metadata: dict = field(default_factory=dict)
