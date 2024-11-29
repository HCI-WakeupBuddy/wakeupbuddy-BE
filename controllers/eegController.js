//eegController.js

const { execFile } = require('child_process');
let startTime = null;
let vibrationCount = 0;
let totalDrowsyTime = 0;


// 학습 세션 시작 API
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
  execFile('python3', ['python_scripts/detect_eeg.py', duration, intensity], (error, stdout, stderr) => {
    if (error) {
      console.error(`파이썬 스크립트 실행 오류: ${error.message}`);
      return res.status(500).json({ error: '파이썬 스크립트 실행에 실패했습니다.' });
    }

    if (stderr) {
      console.error(`파이썬 스크립트 오류 메시지: ${stderr}`);
      return res.status(500).json({ error: '파이썬 스크립트에서 오류가 발생했습니다.' });
    }

    // 파이썬 스크립트 출력 파싱
    try {
      const result = JSON.parse(stdout);
      const {
        totalVibrationCount,
        totalDrowsyTime,
        totalTime,
        totalAwakeTime,
        graphImageFilename
      } = result;

      // 응답으로 클라이언트에 결과 반환
      res.status(200).json({
        message: '학습 세션이 완료되었습니다.',
        totalVibrationCount,
        totalDrowsyTime,
        totalAwakeTime,
        totalTime,
        graphImageUrl: `/images/${graphImageFilename}`
      });

    } catch (parseError) {
      console.error(`파이썬 출력 파싱 오류: ${parseError.message}`);
      res.status(500).json({ error: '파이썬 스크립트 출력 파싱에 실패했습니다.' });
    }
  });
};

// 학습 세션 종료 API
const endSession = (req, res) => {
  const endTime = new Date();
  const totalTime = (endTime - startTime) / 1000; // 총 학습 시간 (초 단위)

  // 통계 데이터 생성
  const report = {
    totalVibrationCount: vibrationCount, // 총 진동 횟수
    totalDrowsyTime, // 총 졸음 시간
    totalTime, // 총 학습 시간
  };

  startTime = null; // 학습 세션 종료 시 초기화

  res.status(200).json({ message: '학습 세션이 종료되었습니다.', report });
};

