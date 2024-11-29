//eegRoutes.js
//EEG 데이터 처리 관련 라우트 파일
//eegController.js에 정의된 함수들을 API 엔드포인트로 연결

const express = require('express');
const { startSession, endSession, getSessionResult } = require('../controllers/eegController');
const router = express.Router();

// 학습 세션 시작 라우트
router.post('/start-session', startSession);

// 학습 결과 가져오기 라우트
router.get('/session-result', getSessionResult);

module.exports = router;

