"""
Модуль экспертного оценивания действий оператора.
Рассчитывает штрафные баллы за нарушение экологии, СИЗ, аварии ПАЗ и экономический ущерб.
"""
from backend.schemas import SimulatorState, OperatorGrade, OperatorAction
from typing import List

class ExpertEvaluator:
    def __init__(self):
        self.paz_trips_count = 0
        self.emission_violations_duration = 0.0
        self.ppe_violations_count = 0
        self.incorrect_actions_count = 0

    def evaluate(self, state: SimulatorState, actions: List[OperatorAction], elapsed_time: float) -> OperatorGrade:
        """
        Расчет итоговой оценки студента на основе текущих показателей.
        """
        score = 100.0
        
        # 1. Штрафы за сработку систем ПАЗ
        tripped_count = sum(1 for item in state.interlocks if item.is_tripped)
        paz_deduction = tripped_count * 15.0
        score -= paz_deduction
        
        # 2. Штрафы за выбросы газов ПДК печи П-1
        if state.furnace.emissions.is_violating:
            self.emission_violations_duration += 0.1  # Вызывается каждые 0.1 сек
            
        emission_deduction = (self.emission_violations_duration / 10.0) * 10.0  # -10 баллов за каждые 10 секунд
        score -= emission_deduction

        # 3. Нарушение правил охраны труда (СИЗ / PPE)
        # Если идет слив воды из Е-1 (уровень падает) или запуск ЭЛОУ, оператор ОБЯЗАН надеть маску БКФ
        e1_water = getattr(state.atm_column, "e1_water_level_pct", 50.0)
        is_draining = e1_water < 45.0
        
        has_mask = state.operator_ppe.has_gas_mask_bkf
        if is_draining and not has_mask:
            self.ppe_violations_count += 1
            # Снимаем 20 баллов за отсутствие средств защиты органов дыхания при дренаже сероводородной воды
            score -= 20.0

        # 4. Расчет экономического ущерба (в млн руб)
        # Базовая цена простоя 3.5 млн руб/ч = 972 руб/сек.
        downtime_hours = (elapsed_time / 3600.0)
        economic_loss = downtime_hours * 3.5  # млн руб
        
        # Потери от сгорания на факеле
        flaring_loss = 0.0
        if state.atm_column.top_pressure > 0.45:
            flaring_loss = (state.atm_column.top_pressure - 0.45) * 5.0  # млн руб
        economic_loss += flaring_loss

        # Итоговое ограничение по баллам
        final_score = max(0.0, min(100.0, score))
        
        # Присваиваем оценку по шкале техрегламента
        if final_score >= 90.0:
            grade = "Отлично"
        elif final_score >= 75.0:
            grade = "Хорошо"
        elif final_score >= 60.0:
            grade = "Удовлетворительно"
        else:
            grade = "Неудовлетворительно"
            
        correct_actions = len(actions) - self.incorrect_actions_count

        return OperatorGrade(
            scenario_id="championship_2026",
            reaction_time_s=elapsed_time,
            actions_correct=max(0, correct_actions),
            actions_total=len(actions),
            accuracy_percent=(correct_actions / len(actions) * 100.0) if len(actions) > 0 else 100.0,
            economic_loss=economic_loss,
            score=final_score,
            grade=grade
        )
