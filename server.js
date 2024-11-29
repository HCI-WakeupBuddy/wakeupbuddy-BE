// server.js
// 메인 서버 파일

// 기본 서버 설정 및 미들웨어 추가
const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const cors = require("cors");
const bodyParser = require("body-parser");
const museRoutes = require("./routes/museRoutes");
const eegRoutes = require("./routes/eegRoutes");
const http = require("http");
const fs = require("fs");

// 환경변수 설정 파일 불러오기
dotenv.config();

// Express 애플리케이션 생성
const app = express();

// CORS 설정 - 프론트엔드에서 백엔드에 접근할 수 있도록 허용
app.use(cors());

// JSON 데이터 파싱 및 body-parser 설정
app.use(bodyParser.json());

// 기본 라우팅 설정
app.use("/api/muse", museRoutes);
app.use("/api/eeg", eegRoutes);

// 그래프 파일 제공을 위한 정적 경로 설정
app.use("/", express.static(path.join(__dirname)));
app.use("/api/results", express.static(path.join(__dirname, "results")));

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});
