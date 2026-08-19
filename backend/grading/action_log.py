"""
Модуль логирования действий оператора.
Записывает все манипуляции с задвижками, насосами и запросы LIMS.
"""
from typing import List
from backend.schemas import OperatorAction

class ActionLogger:
    def __init__(self):
        self.actions: List[OperatorAction] = []

    def log_action(self, timestamp: float, action_type: str, target: str, parameter: str, old_val: float, new_val: float):
        """Регистрация действия оператора."""
        action = OperatorAction(
            timestamp=timestamp,
            action_type=action_type,
            target_equipment=target,
            parameter=parameter,
            old_value=old_val,
            new_value=new_val
        )
        self.actions.append(action)
        print(f"📝 Действие зарегистрировано: {action_type} на {target} ({old_val} -> {new_val})")

    def get_actions(self) -> List[OperatorAction]:
        return self.actions
