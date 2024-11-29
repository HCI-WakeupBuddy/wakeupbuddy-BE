const { spawn } = require("child_process");
const path = require("path");

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
    return res.status(400).json({ error: "Duration and intensity are required" });
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
          ...parsedResult,
          graphImageUrl: `/images/${parsedResult.graphImageFilename}`,
        };
        console.log("Python 결과를 성공적으로 파싱했습니다:", sessionResult);
        resultData = "";
      } catch (error) {
        console.error("JSON 파싱 중 오류:", error.message);
      }
    }
  });

  pythonProcess.stderr.on("data", (error) => {
    console.error(`Python stderr: ${error.toString()}`);
  });

  pythonProcess.on("close", (code) => {
    if (code !== 0) {
      console.error(`Python process exited with code ${code}`);
      sessionStatus = "error";
      sessionResult = { error: "Python script failed to execute." };
    } else {
      sessionStatus = "completed";
      console.log("Python 프로세스 종료 후 결과:", sessionResult);
    }
  });

  res.status(200).json({ message: "학습 세션이 시작되었습니다. 결과는 나중에 조회할 수 있습니다." });
};

// 학습 결과 가져오기 API
const getSessionResult = (req, res) => {
  if (sessionStatus === "running") {
    return res.status(202).json({ message: "세션이 아직 진행 중입니다." });
  }

  if (sessionStatus === "error") {
    return res.status(500).json({ error: "Python 스크립트 실행 중 오류가 발생했습니다." });
  }

  if (sessionStatus === "completed" && sessionResult) {
    return res.status(200).json(sessionResult);
  }

  res.status(404).json({
    message: "학습 결과를 사용할 수 없습니다. 세션이 진행되지 않았거나 완료되지 않았습니다.",
  });
};

module.exports = {
  startSession,
  getSessionResult,
};
