//eegController.js

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let startTime = null;
let vibrationCount = 0;
let totalDrowsyTime = 0;
let sessionResult = null;
let sessionStatus = "idle"; // 상태: "idle", "running", "completed", "error"

// 학습 세션 시작 API
const startSession = (req, res) => {
  const { duration, intensity } = req.body;

  const intensityMapping = {
    level1: 50,
    level2: 150,
    level3: 255,
  };

  const mappedIntensity = intensityMapping[intensity];

  if (!duration || !intensity) {
    return res
      .status(400)
      .json({ error: "Duration and intensity are required" });
  }

  startTime = new Date();
  vibrationCount = 0;
  totalDrowsyTime = 0;
  sessionResult = null;
  sessionStatus = "running";

  console.log(`학습 세션 시작 - 시간: ${duration}분, 진동 강도: ${intensity}`);

  const pythonProcess = spawn("python3", [
    "python_scripts/detect_eeg.py",
    duration,
    mappedIntensity,
  ]);

  // 바로 응답을 반환
  res.status(200).json({ message: "Session started successfully." });

  let resultData = "";

  pythonProcess.stdout.on("data", (data) => {
    resultData += data.toString();
    console.log(`현재 stdout 데이터: ${resultData}`);

    const startIndex = resultData.indexOf("{");
    const endIndex = resultData.lastIndexOf("}");
    if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
      const jsonString = resultData.substring(startIndex, endIndex + 1);
      try {
        const parsedResult = JSON.parse(jsonString);
        sessionResult = {
          //...parsedResult,
          totalVibrationCount: parsedResult.totalVibrationCount,
          totalDrowsyTime: parsedResult.totalDrowsyTime,
          totalTime: parsedResult.totalTime,
          totalAwakeTime: parsedResult.totalAwakeTime,
          graphImageUrl: `/api/results/${parsedResult.graphImageFilename}`,
          jsonFileUrl: `/${parsedResult.jsonFilename}`, // JSON 파일 URL 추가
        };
        console.log("Python 결과를 성공적으로 파싱했습니다:", sessionResult);
        resultData = "";
        //sessionStatus = "completed";
      } catch (error) {
        console.error("JSON 파싱 중 오류:", error.message);
        sessionStatus = "error"; // 상태 업데이트
      }
    }
  });

  pythonProcess.stderr.on("data", (error) => {
    console.error(`Python stderr: ${error.toString()}`);
    sessionStatus = "error";
    sessionResult = { error: `Python script error: ${error.toString()}` };
  });

  pythonProcess.on("close", (code) => {
    if (code !== 0) {
      console.error(`Python process exited with code ${code}`);
      sessionStatus = "error";
      sessionResult = { error: "Python script failed to execute." };
      return;
    }
    // Python이 정상적으로 종료된 경우
    if (sessionResult) {
      console.log("Python 프로세스에서 결과가 성공적으로 처리되었습니다.");
      sessionStatus = "completed"; // stdout 데이터 기준으로 처리 완료
    } else {
      console.error("JSON 파일이 생성되지 않았습니다.");
      sessionStatus = "error";
      sessionResult = { error: "Result JSON file is missing." };
    }
  });
};

// 학습 결과 가져오기 API
const getSessionResult = (req, res) => {
  if (sessionStatus === "running") {
    // 세션이 아직 진행 중일 경우
    return res.status(202).json({ message: "세션이 아직 진행 중입니다." });
  }

  if (sessionStatus === "error") {
    // 세션에서 에러가 발생한 경우
    return res.status(500).json({
      error: "Python 스크립트 실행 중 오류가 발생했습니다.",
      details: sessionResult?.error || "알 수 없는 오류입니다.",
    });
  }

  if (sessionStatus === "completed" && sessionResult) {
    // 세션이 완료되었고 결과가 있는 경우
    return res.status(200).json(sessionResult);
  }

  // 그 외의 경우
  res.status(404).json({
    message:
      "학습 결과를 사용할 수 없습니다. 세션이 진행되지 않았거나 완료되지 않았습니다.",
  });
};

module.exports = {
  startSession,
  getSessionResult,
};
