import numpy as np
import mne
from scipy.signal import welch
from pylsl import StreamInlet, resolve_stream
import requests
import sys
import time

# Get parameters from command line arguments
duration = int(sys.argv[1])  # 학습 시간 (분 단위)
vibration_level = sys.argv[2]  # 진동 강도 ('약', '중', '강')

# Muse2로부터 데이터 수집 (LSL 스트림을 통해)
print("EEG 스트림을 검색 중...")
streams = resolve_stream('type', 'EEG')
inlet = StreamInlet(streams[0])

# 졸음 임계값 설정
THETA_BAND = (4, 8)  # Theta band in Hz
ALPHA_BAND = (8, 12)  # Alpha band in Hz
DROWSINESS_THRESHOLD = 1.5  # 임계값: 세타파 / 알파파 비율

# 졸음 감지 및 진동 모듈 제어
sampling_rate = 256  # Muse2의 샘플링 속도
window_size = 5  # 초 단위로 졸음을 감지
data_buffer = []

start_time = time.time()
end_time = start_time + (duration * 60)

try:
    while time.time() < end_time:
        sample, timestamp = inlet.pull_sample()
        data_buffer.append(sample)

        # 버퍼가 5초 동안의 데이터를 담았으면 분석 수행
        if len(data_buffer) >= sampling_rate * window_size:
            eeg_data = np.array(data_buffer).T  # 각 채널별로 데이터를 분리하기 위해 전치

            # 각 채널에 대해 Power Spectral Density (PSD)를 계산하여 졸음 상태를 판별
            theta_power = []
            alpha_power = []

            for channel in eeg_data:
                freqs, psd = welch(channel, fs=sampling_rate, nperseg=sampling_rate * 2)

                # Theta 파워와 Alpha 파워 계산
                theta_idx = np.logical_and(freqs >= THETA_BAND[0], freqs <= THETA_BAND[1])
                alpha_idx = np.logical_and(freqs >= ALPHA_BAND[0], freqs <= ALPHA_BAND[1])

                theta_power.append(np.sum(psd[theta_idx]))
                alpha_power.append(np.sum(psd[alpha_idx]))

            # 평균 세타 / 알파 비율 계산
            avg_theta_power = np.mean(theta_power)
            avg_alpha_power = np.mean(alpha_power)

            if avg_alpha_power == 0:
                drowsiness_index = float('inf')
            else:
                drowsiness_index = avg_theta_power / avg_alpha_power

            # 졸음 감지 여부 판단
            if drowsiness_index > DROWSINESS_THRESHOLD:
                print("졸음 감지됨! 진동 모듈 작동 필요")
                try:
                    # Node.js 서버에 진동 모듈 작동 요청 보내기
                    response = requests.post('http://localhost:3000/trigger-vibration', json={"intensity": vibration_level})
                    if response.status_code == 200:
                        print(f"진동 모듈이 {vibration_level} 강도로 작동하였습니다.")
                    else:
                        print(f"진동 모듈 작동 실패: {response.status_code}")
                except requests.exceptions.RequestException as e:
                    print(f"진동 모듈 요청 오류: {e}")

            else:
                print("정상 상태")

            # 버퍼 초기화
            data_buffer = []

        time.sleep(1 / sampling_rate)  # 데이터 수집 주기와 맞추기 위해 잠시 대기

except KeyboardInterrupt:
    print("데이터 수집 종료")
