//Arduino IDE에서 실행함
//Arduino Uno
//Port : COM3 (윈도우)

int vibrationPin = 9; // PWM 핀으로 변경
int vibrationIntensity = 0;
unsigned long vibrationStartTime = 0;
unsigned long vibrationDuration = 1000;
bool isVibrating = false;
unsigned long lastVibrationEnd = 0;
unsigned long cooldownTime = 2000; // 2초 쿨다운

void setup() {
  Serial.begin(115200);
  pinMode(vibrationPin, OUTPUT);
  digitalWrite(vibrationPin, LOW);

  while (!Serial) {
    ;
  }
  Serial.println("Arduino is ready!");
}

void loop() {
  // 진동 시간 관리
  if (isVibrating && millis() - vibrationStartTime >= vibrationDuration) {
    digitalWrite(vibrationPin, LOW);
    isVibrating = false;
    vibrationIntensity = 0;
    lastVibrationEnd = millis();
    Serial.println("Vibration stopped.");
  }

  // 시리얼 데이터 처리
  if (Serial.available() > 0) {
    String data = Serial.readStringUntil('\n');
    int commaIndex = data.indexOf(',');

    if (commaIndex > 0) {
      String signal = data.substring(0, commaIndex);
      vibrationIntensity = data.substring(commaIndex + 1).toInt();

      if (vibrationIntensity < 0 || vibrationIntensity > 255) {
        Serial.println("Invalid intensity received. Must be between 0 and 255.");
        return;
      }

      if (signal == "1" && !isVibrating && millis() - lastVibrationEnd >= cooldownTime) {
        analogWrite(vibrationPin, vibrationIntensity);
        vibrationStartTime = millis();
        isVibrating = true;
        Serial.print("Vibration started with intensity: ");
        Serial.println(vibrationIntensity);
      } else if (signal == "0") {
        digitalWrite(vibrationPin, LOW);
        isVibrating = false;
        vibrationIntensity = 0;
        Serial.println("Received signal to stop vibration.");
      } else {
        Serial.println("Invalid signal received or cooldown in effect.");
      }
    } else {
      Serial.println("Malformed data received.");
    }
  }
}
