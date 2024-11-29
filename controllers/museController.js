// museController.js
// Muse2 착용 상태 관련 기능

const { spawn } = require('child_process');
let museStatus = false;

const checkMuseStatus = (req, res) => {
  const pythonProcess = spawn('python3', ['check_muse_status.py']); // Python 스크립트 실행

  let output = '';
  pythonProcess.stdout.on('data', (data) => {
    output += data.toString();
  });

  pythonProcess.stdout.on('end', () => {
    console.log(`Python 출력: ${output}`);

    if (output.includes('정상 착용')) {
      museStatus = true;
    } else if (output.includes('착용 안 됨')) {
      museStatus = false;
    }

    res.status(200).json({ message: `Muse2 착용 상태: ${museStatus ? '정상 착용' : '착용 안 됨'}`,
      status: museStatus, // Boolean 값 추가
    });
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python 오류: ${data}`);
    res.status(500).json({ error: `Python 오류: ${data.toString()}` });
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python 프로세스 종료 코드: ${code}`);
  });
};

module.exports = {
  checkMuseStatus
};
