//museController.js
//Muse2 착용 상태 관련 기능

let museStatus = false;

const checkMuseStatus = (req, res) => {
  const { status } = req.body; // T/F 형태로 착용 상태 전달
  museStatus = status;
  res.status(200).json({ message: `Muse2 착용 상태: ${status ? '정상 착용' : '착용 안 됨'}` });
};

module.exports = {
  checkMuseStatus,
};