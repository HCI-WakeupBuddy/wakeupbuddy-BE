const { spawn } = require("child_process");
let museStatus = false;

const checkMuseStatus = (req, res) => {
  const pythonProcess = spawn("python", [
    "python_scripts/check_muse_status.py",
  ]); // Python 경로 수정

  let output = "";
  let errorOccurred = false; // 에러 발생 여부 플래그

  pythonProcess.stdout.on("data", (data) => {
    output += data.toString();
  });

  pythonProcess.stdout.on("end", () => {
    if (!errorOccurred) {
      // 에러가 발생하지 않은 경우에만 응답
      console.log(`Python 출력: ${output}`);

      if (output.includes("정상 착용")) {
        museStatus = true;
      } else if (output.includes("착용 안 됨")) {
        museStatus = false;
      }

      res.status(200).json({
        message: `Muse2 착용 상태: ${museStatus ? "정상 착용" : "착용 안 됨"}`,
        status: museStatus,
      });
    }
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error(`Python 오류: ${data}`);
    errorOccurred = true; // 에러 발생 플래그 설정
    res.status(500).json({ error: `Python 오류: ${data.toString()}` });
  });

  pythonProcess.on("close", (code) => {
    console.log(`Python 프로세스 종료 코드: ${code}`);
  });
};

module.exports = {
  checkMuseStatus,
};
