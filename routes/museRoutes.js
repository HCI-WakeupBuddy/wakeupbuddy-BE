//museRoutes.js
//Muse2 관련 라우트 파일

const express = require('express');
const { checkMuseStatus, getMuseStatus } = require('../controllers/museController');
const router = express.Router();

// Muse2 착용 상태 확인 라우트 (POST 요청으로 상태 업데이트)
router.post('/muse-status', checkMuseStatus);

// Muse2 착용 상태 반환 라우트 (GET 요청으로 상태 조회)
router.get('/muse-status', getMuseStatus);

module.exports = router;

// 프론트엔드에서 /muse-status로 GET 요청을 보내면 현재 Muse 착용 상태를 확인할 수 있음.