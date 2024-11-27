//eegController.js
//EEG 데이터 처리 로직
//EEG 데이터 수집과 학습 세션 시작/종료와 같은 로직을 정의

let startTime = null;
let vibrationCount = 0;
let totalDrowsyTime = 0; 

const startSession = (req, res) => {
  const { duration, intensity } = req.body;

  // 학습 시간과 진동 강도 유효성 검사
  if (!duration || !intensity) {
    return res.status(400).json({ error: 'Duration and intensity are required' });
  }

  startTime = new Date();
  vibrationCount = 0;
  totalDrowsyTime = 0;

  console.log(`학습 세션 시작 - 시간: ${duration}분, 진동 강도: ${intensity}`);
  res.status(200).json({ message: '학습 세션이 시작되었습니다.', duration, intensity });
};

const endSession = (req, res) => {
  const endTime = new Date();
  const totalTime = (endTime - startTime) / 1000; // 총 학습 시간 (초 단위)

  // 통계 데이터 생성
  const report = {
    totalVibrationCount: vibrationCount,
    totalDrowsyTime,
    totalTime,
  };

  res.status(200).json({ message: '학습 세션이 종료되었습니다.', report });
};

const receiveEegData = (req, res) => {
  const { timestamp, eegData } = req.body;

  if (!eegData) {
    return res.status(400).json({ error: 'EEG 데이터가 필요합니다.' });
  }

  // EEG 데이터를 수신하고 분석하는 로직은 추가 구현 필요

  // 현재는 데이터 수신 성공 여부만 응답
  res.status(200).json({ message: 'EEG 데이터가 성공적으로 수신되었습니다.' });
};

module.exports = {
  startSession,
  endSession,
  receiveEegData,
};
