// 메인 서버 파일

// 기본 서버 설정 및 미들웨어 추가
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Board, Led } = require('johnny-five');
const SerialPort = require('serialport');
const multer = require('multer')
const { spawn } = require('child_process');

// 환경변수 설정 파일 불러오기
dotenv.config();

// Express 애플리케이션 생성
const app = express();

// CORS 설정 - 프론트엔드에서 백엔드에 접근할 수 있도록 허용
app.use(cors());

// JSON 데이터 파싱 및 body-parser 설정
app.use(bodyParser.json());

// 기본 라우팅 설정
// 간단한 기본 라우트 예시
app.get('/', (req, res) => {
    res.send('Node.js 백엔드 서버가 정상적으로 동작합니다.');
});

//Muse2 착용 상태 확인 및 데이터 처리 API
let museStatus = false; // Muse2 착용 상태를 확인하는 변수
  
// Muse2 착용 상태 확인 API
app.post('/muse-status', (req, res) => {
    const { status } = req.body; // T/F 형태로 착용 상태 전달
    museStatus = status;
    res.status(200).json({ message: `Muse2 착용 상태: ${status ? '정상 착용' : '착용 안 됨'}` });
});

// EEG 데이터 수신 및 저장 라우트
app.post('/eeg-data', (req, res) => {
    const { timestamp, eegData } = req.body;
    // 수신한 데이터를 처리하여 데이터베이스에 저장
    // mongoose를 사용해 eeg 데이터를 저장하는 부분을 구현
    res.status(200).json({ message: 'EEG 데이터가 성공적으로 수신되었습니다.' });
});

// 아두이노 진동 모듈 제어 추가 설정
// Arduino 보드 초기화
const board = new Board({
  port: new SerialPort('/dev/ttyACM0') // Arduino가 연결된 포트 경로를 적절히 수정
});

let vibrationMotor;

board.on('ready', () => {
  console.log('Arduino 보드가 준비되었습니다.');

  // 진동 모듈 (디지털 핀 9에 연결되어 있다고 가정)
  vibrationMotor = new Led(9);

  // 기본적으로 진동 모듈을 꺼둡니다.
  vibrationMotor.off();
});

// 학습 설정 및 진동 모듈 제어 API
let vibrationCount = 0;
let totalDrowsyTime = 0;
let startTime = null;

app.post('/start-session', (req, res) => {
  const { duration, intensity } = req.body; // 학습 시간 (분 단위), 진동 세기 ('약', '중', '강')
  startTime = new Date();
  vibrationCount = 0;
  totalDrowsyTime = 0;
  res.status(200).json({ message: '학습 세션이 시작되었습니다.', duration, intensity });

  // 실시간 EEG 데이터 분석 로직은 추가 구현 필요 (졸음 감지 시 아래 triggerVibration 함수 호출)
});

function triggerVibration(intensity) {
    if (!vibrationMotor) {
      console.error('Arduino 보드가 아직 준비되지 않았습니다.');
      return;
    }
  
    // 진동 강도 설정 (예: 약 = 1초, 중 = 2초, 강 = 3초)
    let duration;
    switch (intensity) {
      case '약':
        duration = 1000;
        break;
      case '중':
        duration = 2000;
        break;
      case '강':
        duration = 3000;
        break;
      default:
        console.error('잘못된 진동 강도 값입니다.');
        return;
    }
  
    // 진동 모듈 작동 (주어진 강도에 따라 진동 시간을 설정)
    vibrationMotor.on();
    setTimeout(() => {
      vibrationMotor.off();
    }, duration);
  
    vibrationCount++;
    console.log(`진동 모듈이 ${intensity} 강도로 작동하였습니다.`);
  }

// 학습 종료 및 통계 생성
app.post('/end-session', (req, res) => {
    const endTime = new Date();
    const totalTime = (endTime - startTime) / 1000; // 총 학습 시간 (초 단위)
  
    // 통계 데이터 생성
    const report = {
      totalVibrationCount: vibrationCount,
      totalDrowsyTime,
      totalTime,
    };
  
    res.status(200).json({ message: '학습 세션이 종료되었습니다.', report });
  });

// 서버 시작
app.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  });