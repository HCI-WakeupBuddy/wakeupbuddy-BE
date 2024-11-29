// museController.js
// Muse2 착용 상태 관련 기능

const { spawn } = require('child_process');
let museStatus = false;

const checkMuseStatus = (req, res) => {
  const pythonProcess = spawn('python3', ['muse_status_checker.py']); // Python 스크립트 실행

  pythonProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`Python 출력: ${output}`);

    // Python 스크립트가 착용 상태를 전달하는 부분을 기반으로 상태 업데이트
    if (output.includes('정상 착용')) {
      museStatus = true;
    } else if (output.includes('착용 안 됨')) {
      museStatus = false;
    }

    res.status(200).json({ message: `Muse2 착용 상태: ${museStatus ? '정상 착용' : '착용 안 됨'}` });
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python 오류: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python 프로세스 종료 코드: ${code}`);
  });
};

// Muse 착용 상태를 반환하는 함수
const getMuseStatus = (req, res) => {
  res.status(200).json({ status: museStatus, message: museStatus ? '정상 착용' : '착용 안 됨' });
};

module.exports = {
  checkMuseStatus,
  getMuseStatus,
};
