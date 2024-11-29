// eegController.js
const { execFile } = require('child_process');
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

  // detect_eeg.py 파일 실행 및 학습 시간과 진동 강도 전달
  execFile('python3', ['detect_eeg.py', duration, intensity], (error, stdout, stderr) => {
    if (error) {
      console.error(`파이썬 스크립트 실행 오류: ${error.message}`);
      return res.status(500).json({ error: '파이썬 스크립트 실행에 실패했습니다.' });
    }

    if (stderr) {
      console.error(`파이썬 스크립트 오류 메시지: ${stderr}`);
      return res.status(500).json({ error: '파이썬 스크립트에서 오류가 발생했습니다.' });
    }

    console.log(`파이썬 스크립트 출력: ${stdout}`);
    res.status(200).json({ message: '학습 세션이 시작되었습니다.', duration, intensity });
  });
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

  res.status(200).json({ message: 'EEG 데이터가 성공적으로 수신되었습니다.' });
};

module.exports = {
  startSession,
  endSession,
  receiveEegData,
};
