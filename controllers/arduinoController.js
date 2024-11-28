//arduinoController.js
//아두이노 진동 모듈 제어 기능
//Johnny-Five와 SerialPort를 사용하여 아두이노와의 통신을 관리

const { Board, Led } = require('johnny-five');
const SerialPort = require('serialport');

// Arduino 보드 초기화
const board = new Board({
  port: new SerialPort({ path: '/dev/ttyACM0', baudRate: 9600 }) // 경로를 적절히 수정하세요
});

let vibrationMotor;

board.on('ready', () => {
  console.log('Arduino 보드가 준비되었습니다.');

  // 진동 모듈 (디지털 핀 9에 연결되어 있다고 가정)
  vibrationMotor = new Pin(9);

  // 기본적으로 진동 모듈을 꺼둡니다.
  vibrationMotor.low();
});

const triggerVibration = (req, res) => {
  const { intensity } = req.body; // '약', '중', '강' 중 하나의 값이 올 것으로 가정합니다.

  if (!vibrationMotor) {
    return res.status(500).json({ message: 'Arduino 보드가 아직 준비되지 않았습니다.' });
  }

  // 진동 세기 설정 by pwmWrite(dutyCycle)
  let pwmValue;
  switch (intensity) {
    case '약':
      pwmValue = 50; // 약한 진동 (50% 세기)
      break;
    case '중':
      pwmValue = 150; // 중간 진동 (150 PWM 값)
      break;
    case '강':
      pwmValue = 255; // 강한 진동 (최대 세기)
      break;
    default:
      return res.status(400).json({ message: '잘못된 진동 강도 값입니다.' });
  }

  // PWM 값을 설정하여 진동 모듈 제어
  vibrationMotor.pwmWrite(pwmValue);
  setTimeout(() => {
    vibrationMotor.low(); // 진동 멈춤
  }, 1000); // 1초 동안 진동 후 멈춤

  res.status(200).json({ message: `진동 모듈이 ${intensity} 강도로 작동하였습니다.` });
};

module.exports = {
  triggerVibration,
};
