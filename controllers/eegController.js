// eegController.js

const { execFile } = require('child_process');
let startTime = null;
let vibrationCount = 0;
let totalDrowsyTime = 0;
let sessionResult = null;

// 학습 세션 시작 API
const startSession = (req, res) => {
  const { duration, intensity } = req.body;
  
  // 진동 강도 매핑
  const intensityMapping = {
    "level 1": 50,
    "level 2": 150,
    "level 3": 255
  };
  const mappedIntensity = intensityMapping[intensity]; // 진동 강도를 숫자로 변환

  // 학습 시간과 진동 강도 유효성 검사
  if (!duration || !intensity) {
    return res.status(400).json({ error: 'Duration and intensity are required' });
  }

  startTime = new Date();
  vibrationCount = 0;
  totalDrowsyTime = 0;
  sessionResult = null;

  console.log(`학습 세션 시작 - 시간: ${duration}분, 진동 강도: ${intensity}`);

  // detect_eeg.py 파일 실행 및 학습 시간과 진동 강도 전달
  execFile('python3', ['python_scripts/detect_eeg.py', duration, mappedIntensity], (error, stdout, stderr) => {
    if (error) {
      console.error(`파이썬 스크립트 실행 오류: ${error.message}`);
      sessionResult = { error: '파이썬 스크립트 실행에 실패했습니다.' };
      return;
    }

    if (stderr) {
      console.error(`파이썬 스크립트 오류 메시지: ${stderr}`);
      sessionResult = { error: '파이썬 스크립트에서 오류가 발생했습니다.' };
      return;
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

      // 학습 결과 저장
      sessionResult = {
        message: '학습 세션이 완료되었습니다.',
        totalVibrationCount,
        totalDrowsyTime,
        totalAwakeTime,
        totalTime,
        graphImageUrl: `/images/${graphImageFilename}`
      };

    } catch (parseError) {
      console.error(`파이썬 출력 파싱 오류: ${parseError.message}`);
      sessionResult = { error: '파이썬 스크립트 출력 파싱에 실패했습니다.' };
    }
  });

  // 즉시 응답 반환
  res.status(200).json({ message: '학습 세션이 시작되었습니다. 결과는 나중에 조회할 수 있습니다.' });
};

// 학습 결과 가져오기 API
const getSessionResult = (req, res) => {
  if (!sessionResult) {
    return res.status(404).json({ message: '학습 결과를 사용할 수 없습니다. 세션이 아직 진행 중이거나 완료되지 않았습니다.' });
  }
  res.status(200).json(sessionResult);
};

module.exports = {
  startSession,
  getSessionResult,
};
