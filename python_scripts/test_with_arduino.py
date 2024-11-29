#test.py
#실시간 졸음 탐지 및 백엔드 연결

import sys
import time
import numpy as np
import pandas as pd
import json
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.dates import DateFormatter
from datetime import datetime
from muselsl import list_muses
from pylsl import StreamInlet, resolve_stream
from scipy.signal import butter, filtfilt, detrend
from mne.preprocessing import ICA
from mne import create_info, EpochsArray
import threading
import subprocess
import serial  # 아두이노 시리얼 통신을 위한 모듈
import serial.tools.list_ports

# 사용 가능한 포트에서 아두이노를 검색하는 함수
def find_arduino_port():
    ports = serial.tools.list_ports.comports()
    for port in ports:
        if 'Arduino' in port.description:
            return port.device
    return None

# 메인 함수에서 아두이노 연결
arduino_port = find_arduino_port()
if arduino_port is None:
    print("Arduino not found. Please check the connection.")
    print("Available ports:")
    ports = serial.tools.list_ports.comports()
    for port in ports:
        print(f"Port: {port.device}, Description: {port.description}")
    sys.exit(1)

try:
    arduino = serial.Serial(arduino_port, 9600)
    print(f"Arduino connected on port {arduino_port}")
except serial.SerialException as e:
    print(f"Failed to connect to Arduino on port {arduino_port}: {e}")
    sys.exit(1)

# 이벤트 객체 생성 (스레드 종료 신호)
stop_event = threading.Event()


# Muse 스트림 실행 함수
def start_muse_stream():
    print("Starting Muse stream as a subprocess...")
    process = subprocess.Popen(['muselsl', 'stream'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return process


# Muse 스트림 종료 함수
def stop_muse_stream(process):
    print("Stopping Muse stream...")
    process.terminate()
    process.wait()


# 밴드패스 필터
def butter_bandpass(lowcut, highcut, fs, order=5):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    return b, a


def bandpass_filter(data, lowcut=4.0, highcut=40.0, fs=256, order=5):
    b, a = butter_bandpass(lowcut, highcut, fs, order=order)
    return filtfilt(b, a, data, axis=0)


# EEG 데이터 전처리 함수
def preprocess_eeg(data, sampling_rate=256):
    filtered_data = bandpass_filter(data, lowcut=4.0, highcut=40.0, fs=sampling_rate)
    detrended_data = detrend(filtered_data, axis=0)

    ch_names = ['TP9', 'AF7', 'AF8', 'TP10']
    ch_types = ['eeg'] * len(ch_names)
    info = create_info(ch_names=ch_names, sfreq=sampling_rate, ch_types=ch_types)
    data = detrended_data.T[np.newaxis, :, :]
    raw = EpochsArray(data, info)
    ica = ICA(n_components=len(ch_names), random_state=0, max_iter="auto")
    ica.fit(raw)
    ica.exclude = [0]
    processed_data = ica.apply(raw).get_data()[0].T

    return processed_data


# EEG 데이터 수집 함수
def collect_eeg_data(duration, sampling_rate=256):
    print("Resolving EEG stream...")
    try:
        streams = resolve_stream('type', 'EEG')
        if not streams:
            raise RuntimeError("No EEG streams found. Please ensure Muse is streaming.")
    except RuntimeError as e:
        print(f"Error: {e}")
        return None

    inlet = StreamInlet(streams[0])

    print("EEG stream resolved. Collecting data...")
    data_buffer = []
    start_time = time.time()
    while time.time() - start_time < duration:
        eeg_data, _ = inlet.pull_sample(timeout=1.0)
        if eeg_data:
            data_buffer.append(eeg_data[:4])  # AUX 채널 제외
        else:
            print("No data received during this cycle.")
        time.sleep(1 / sampling_rate)

    return np.array(data_buffer)


# 특징 추출 함수 (Theta/Alpha, Theta/Beta 비율 계산)
def extract_features(data):
    freq_bands = {"Theta": (4, 8), "Alpha": (8, 12), "Beta": (13, 30)}
    sampling_rate = 256

    fft_data = np.fft.rfft(data, axis=0)
    freqs = np.fft.rfftfreq(len(data), d=1 / sampling_rate)

    band_powers = {
        band: np.sum(np.abs(fft_data[(freqs >= low) & (freqs < high)])**2, axis=0)
        for band, (low, high) in freq_bands.items()
    }

    theta_alpha_ratio = band_powers["Theta"] / band_powers["Alpha"]
    theta_beta_ratio = band_powers["Theta"] / band_powers["Beta"]

    return theta_alpha_ratio.mean(), theta_beta_ratio.mean()


# 시각화 함수
def visualize_drowsiness_trend(drowsy_events, awake_events):
    plt.figure(figsize=(14, 7))

    # 데이터 준비
    drowsy_timestamps = [datetime.strptime(event["Timestamp"], "%Y-%m-%d %H:%M:%S") for event in drowsy_events]
    awake_timestamps = [datetime.strptime(event["Timestamp"], "%Y-%m-%d %H:%M:%S") for event in awake_events]

    drowsy_theta_alpha = [event["Theta/Alpha"] for event in drowsy_events]
    drowsy_theta_beta = [event["Theta/Beta"] for event in drowsy_events]
    awake_theta_alpha = [event["Theta/Alpha"] for event in awake_events]
    awake_theta_beta = [event["Theta/Beta"] for event in awake_events]

    # 그래프에 점 추가
    plt.scatter(drowsy_timestamps, drowsy_theta_alpha, color='red', label='Drowsy Theta/Alpha', alpha=0.7)
    plt.scatter(drowsy_timestamps, drowsy_theta_beta, color='darkred', label='Drowsy Theta/Beta', alpha=0.7)
    plt.scatter(awake_timestamps, awake_theta_alpha, color='blue', label='Awake Theta/Alpha', alpha=0.7)
    plt.scatter(awake_timestamps, awake_theta_beta, color='darkblue', label='Awake Theta/Beta', alpha=0.7)

    plt.xlabel("Time")
    plt.ylabel("Ratio")
    plt.title("Real-Time Drowsiness Detection")
    plt.legend()
    plt.gca().xaxis.set_major_formatter(DateFormatter('%H:%M:%S'))
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig("drowsiness_trend_plot.png")
    plt.show()


# 실시간 졸음 탐지 함수
def real_time_drowsiness_detection(thresholds, duration_minutes, vibration_intensity):
    theta_alpha_threshold, theta_beta_threshold = thresholds
    drowsy_events = []
    awake_events = []
    vibration_count = 0

    start_time = time.time()
    end_time = start_time + duration_minutes * 60

    # 아두이노 연결 확인
    arduino_port = find_arduino_port()
    arduino_connected = False
    if arduino_port:
        try:
            arduino = serial.Serial(arduino_port, 9600)
            arduino_connected = True
            print(f"Arduino connected on port {arduino_port}")
        except serial.SerialException as e:
            print(f"Failed to connect to Arduino on port {arduino_port}: {e}")
    else:
        print("Arduino not found. Continuing without Arduino support.")


    while time.time() < end_time:
        print("Collecting EEG data for 5 seconds...")
        eeg_data = collect_eeg_data(duration=5)
        if eeg_data is None or eeg_data.shape[0] == 0:
            continue

        preprocessed_data = preprocess_eeg(eeg_data)
        theta_alpha, theta_beta = extract_features(preprocessed_data)

        timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
        if theta_alpha > theta_alpha_threshold or theta_beta > theta_beta_threshold:
            print(f"Drowsiness detected at {timestamp}")
            drowsy_events.append({"Timestamp": timestamp, "Theta/Alpha": theta_alpha, "Theta/Beta": theta_beta})
            vibration_count += 1
            # 아두이노가 연결된 경우에만 진동 전달
            if arduino_connected:
                try:
                    arduino.write(f"{vibration_intensity}\n".encode())
                    print(f"Vibration command sent: {vibration_intensity}")
                except serial.SerialException as e:
                    print(f"Failed to send vibration command: {e}")
        else:
            print(f"Awake at {timestamp}")
            awake_events.append({"Timestamp": timestamp, "Theta/Alpha": theta_alpha, "Theta/Beta": theta_beta})

    visualize_drowsiness_trend(drowsy_events, awake_events)
    result = {
        "totalVibrationCount": vibration_count,
        "totalDrowsyTime": vibration_count * 5,
        "totalAwakeTime": (time.time() - start_time) - (vibration_count * 5)
    }
    with open("drowsiness_results.json", "w") as file:
        json.dump(result, file, indent=4)
    print("Results saved to 'drowsiness_results.json'")


# 메인 함수
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 test.py <duration_minutes> <vibration_intensity>")
        sys.exit(1)

    duration_minutes = int(sys.argv[1])
    vibration_intensity = int(sys.argv[2])

    thresholds = (3.50, 3.08)

    stream_process = start_muse_stream()
    time.sleep(2)

    try:
        real_time_drowsiness_detection(thresholds, duration_minutes, vibration_intensity)
    finally:
        stop_muse_stream(stream_process)
        print("Stopping Muse stream.")
