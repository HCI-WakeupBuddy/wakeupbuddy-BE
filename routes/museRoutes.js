//museRoutes.js
//Muse2 관련 라우트 파일

const express = require('express');
const { checkMuseStatus } = require('../controllers/museController');
const router = express.Router();

// Muse2 착용 상태 확인 라우트
router.post('/muse-status', checkMuseStatus);

module.exports = router;