//arduinoRoute.js
//아두이노 관련 라우트 파일
//arduinoController.js에 정의된 함수들을 엔드포인트로 연결

const express = require('express');
const { triggerVibration } = require('../controllers/arduinoController');
const router = express.Router();

// 진동 모듈 제어 라우트
router.post('/trigger-vibration', triggerVibration);

module.exports = router;
