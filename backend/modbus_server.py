"""
Промышленный Modbus TCP сервер для связи КТК с физическими контроллерами АСУ ТП (ПЛК).
Позволяет читать телеметрию датчиков и записывать уставки задвижек/насосов.
Карта регистров (Holding Registers):
- Регистр 0: Расход сырья, м3/ч
- Регистр 1: Температура сырья, °C
- Регистр 2: Напряжение ЭЛОУ ступень 1, кВ
- Регистр 3: Напряжение ЭЛОУ ступень 2, кВ
- Регистр 4: Давление К-1, МПа * 1000
- Регистр 5: Температура верха К-1, °C
- Регистр 6: Уровень в Е-1, %
- Регистр 10: Уставка задвижки сырья (Запись), %
- Регистр 11: Уставка задвижки газа печи (Запись), %
"""
import asyncio
import logging
from pymodbus.server import StartAsyncTcpServer
from pymodbus.datastore import ModbusSequentialDataBlock, ModbusDeviceContext, ModbusServerContext

# Настройка логирования Modbus
logging.basicConfig()
log = logging.getLogger("pymodbus.server")
log.setLevel(logging.ERROR)

class ModbusBridge:
    def __init__(self, host="127.0.0.1", port=5020):
        self.host = host
        self.port = port
        
        # Инициализируем блоки регистров (100 регистров)
        # hr - Holding Registers
        self.hr_block = ModbusSequentialDataBlock(1, [0] * 100)
        self.store = ModbusDeviceContext(hr=self.hr_block)
        self.context = ModbusServerContext(devices=self.store, single=True)
        self.server_task = None

    async def start(self):
        """Запуск Modbus TCP сервера в асинхронном режиме."""
        print(f"Modbus TCP server starting on {self.host}:{self.port}...")
        self.server_task = asyncio.create_task(
            StartAsyncTcpServer(
                context=self.context,
                address=(self.host, self.port)
            )
        )

    async def stop(self):
        """Останов Modbus сервера."""
        if self.server_task:
            self.server_task.cancel()
            try:
                await self.server_task
            except asyncio.CancelledError:
                pass
            print("Modbus TCP server stopped.")

    def update_telemetry(self, state):
        """
        Запись текущего состояния симулятора в Holding Registers (Регистры 0 - 9).
        Modbus работает только с целыми числами, поэтому умножаем МПа на 1000.
        """
        # Регистры чтения (Телеметрия)
        self.hr_block.setValues(1, [
            int(state.crude_feed.flow_rate),
            int(state.crude_feed.temperature),
            int(state.desalter.stage1_voltage),
            int(state.desalter.stage2_voltage),
            int(state.atm_column.top_pressure * 1000), # МПа * 1000 (например, 0.12 МПа -> 120)
            int(state.atm_column.top_temperature),
            int(getattr(state.atm_column, "e1_water_level_pct", 50.0))
        ])

    def validate_address_bounds(self, address: int, count: int = 1) -> bool:
        """
        Проверка валидности адресов Modbus (Исключение 0x02: Illegal Data Address).
        Валидный диапазон Holding Registers: 1 .. 100.
        """
        if address < 1 or (address + count - 1) > 100:
            return False
        return True

    def read_operator_inputs(self) -> dict:
        """
        Чтение управляющих регистров, записанных внешним ПЛК (Регистры 10 - 19).
        С защитой от выпадания за пределы адресного пространства (Modbus Exception 0x02).
        """
        if not self.validate_address_bounds(11, 2):
            return {"error": "Modbus Exception 0x02: Illegal Data Address"}
        values = self.hr_block.getValues(11, 2)
        return {
            "feed_valve_setpoint": values[0],
            "fuel_valve_setpoint": values[1]
        }
