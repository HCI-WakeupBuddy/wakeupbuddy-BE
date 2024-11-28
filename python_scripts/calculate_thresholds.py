# calculate_thresholds.py 
# 2.임곗값 계산 - 임곗값 계산 및 출력 확인

import os
import pandas as pd
import numpy as np

# 특징 추출 함수 (Theta/Alpha, Theta/Beta 비율 계산)
def extract_features(data):
    # 데이터는 각 채널(TP9, AF7, AF8, TP10)의 신호가 열로 구성된 데이터프레임
    freq_bands = {"Theta": (4, 8), "Alpha": (8, 12), "Beta": (13, 30)}
    sampling_rate = 256

    # FFT를 통해 주파수 스펙트럼 계산
    fft_data = np.fft.rfft(data, axis=0)
    freqs = np.fft.rfftfreq(len(data), d=1 / sampling_rate)

    # 각 주파수 대역의 파워 계산
    band_powers = {
        band: np.sum(np.abs(fft_data[(freqs >= low) & (freqs < high)])**2, axis=0)
        for band, (low, high) in freq_bands.items()
    }

    # Theta/Alpha 및 Theta/Beta 비율 계산
    theta_alpha_ratio = band_powers["Theta"] / band_powers["Alpha"]
    theta_beta_ratio = band_powers["Theta"] / band_powers["Beta"]

    return theta_alpha_ratio.mean(), theta_beta_ratio.mean()

# Awake와 Drowsy 데이터에서 평균 비율 계산
def calculate_thresholds(data_dir):
    states = ["awake", "drowsy"]
    thresholds = {}

    for state in states:
        state_dir = os.path.join(data_dir, state)
        theta_alpha_ratios = []
        theta_beta_ratios = []

        for file in os.listdir(state_dir):
            if file.endswith(".csv"):
                file_path = os.path.join(state_dir, file)
                data = pd.read_csv(file_path)
                
                # 특징값 추출
                theta_alpha, theta_beta = extract_features(data.values)
                theta_alpha_ratios.append(theta_alpha)
                theta_beta_ratios.append(theta_beta)

        # 상태별 평균 비율 계산
        thresholds[state] = {
            "Theta/Alpha": np.mean(theta_alpha_ratios),
            "Theta/Beta": np.mean(theta_beta_ratios)
        }

    return thresholds

if __name__ == "__main__":
    # 데이터 경로 설정 (threshold/data)
    data_dir = "data"

    # 임곗값 계산
    thresholds = calculate_thresholds(data_dir)

    # 결과 출력
    print("Calculated Thresholds:")
    for state, values in thresholds.items():
        print(f"{state.capitalize()} - Theta/Alpha: {values['Theta/Alpha']:.2f}, Theta/Beta: {values['Theta/Beta']:.2f}")