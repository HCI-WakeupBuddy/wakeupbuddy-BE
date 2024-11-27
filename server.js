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
const http = require('http');
const socketIo = require('socket.io');

// 환경변수 설정 파일 불러오기
dotenv.config();

// Express 애플리케이션 생성
const app = express();

// CORS 설정 - 프론트엔드에서 백엔드에 접근할 수 있도록 허용
app.use(cors());

// JSON 데이터 파싱 및 body-parser 설정
app.use(bodyParser.json());

// 기본 라우팅 설정
app.use('/api/muse', museRoutes);
app.use('/api/eeg', eegRoutes);
app.use('/api/arduino', arduinoRoutes);

// Socket.io 설정
const server = http.createServer(app);
const io = socketIo(server);

let startTime = null;

io.on('connection', (socket) => {
  console.log('프론트엔드와 연결되었습니다.');

  // 학습 세션 중 시간 업데이트
  setInterval(() => {
    if (startTime) {
      const currentTime = new Date();
      const elapsedTime = Math.floor((currentTime - startTime) / 1000); // 초 단위 경과 시간
      socket.emit('time-update', { elapsedTime });
    }
  }, 1000); // 1초마다 업데이트
});

// 학습 세션 시작 API
app.post('/api/start-session', (req, res) => {
    const { duration, intensity } = req.body;
  
    // 학습 시간과 진동 강도 유효성 검사
    if (!duration || !intensity) {
      return res.status(400).json({ error: 'Duration and intensity are required' });
    }
  
    startTime = new Date();
    console.log(`학습 세션 시작 - 시간: ${duration}분, 진동 강도: ${intensity}`);
  
    res.status(200).json({ message: '학습 세션이 시작되었습니다.', duration, intensity });
});
  
// 학습 세션 종료 API
app.post('/api/end-session', (req, res) => {
    const endTime = new Date();
    const totalTime = (endTime - startTime) / 1000; // 총 학습 시간 (초 단위)
  
    // 통계 데이터 생성
    const report = {
      totalVibrationCount: 0, // 진동 횟수는 실제 구현에 따라 수정 필요
      totalDrowsyTime: 0, // 졸음 시간 계산 필요
      totalTime,
    };
  
    startTime = null; // 학습 세션 종료 시 초기화
  
    res.status(200).json({ message: '학습 세션이 종료되었습니다.', report });
});

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  });