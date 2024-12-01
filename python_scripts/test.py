#detect_eeg.py
#실시간 졸음 탐지 및 백엔드 연결

from email import message
import sys
import time
import numpy as np
import pandas as pd
import json
import matplotlib.pyplot as plt
from muselsl import list_muses
from pylsl import StreamInlet, resolve_stream, resolve_byprop
from scipy.signal import butter, filtfilt, detrend
from mne.preprocessing import ICA
from mne import create_info, EpochsArray
from mne.time_frequency import psd_array_multitaper
import threading
import subprocess
import logging
import serial  # 추가: 아두이노 시리얼 통신을 위한 모듈
import requests
import os


# Arduino 연결 설정
arduino_port = 'COM3'  # 아두이노가 연결된 포트 (Windows는 COMx, Linux/Mac은 /dev/ttyACM0와 유사)
baud_rate = 115200

# Arduino 시리얼 연결
try:
    arduino = serial.Serial(arduino_port, baud_rate, timeout=1)
    logging.info(f"Arduino connected on port {arduino_port}")
except serial.SerialException as e:
    logging.error(f"Could not connect to Arduino: {e}")
    arduino = None

def send_to_arduino(signal, intensity):
    if arduino:
        try:
            # 신호와 진동 강도를 전송
            message = f"{signal},{intensity}\n"
            arduino.write(message.encode())
            logging.info(f"Sent to Arduino: {message.strip()}")
        except Exception as e:
            logging.error(f"Failed to send data to Arduino: {e}")

# 로그 파일 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("drowsiness_detection.log"),  # 로그 파일 저장
        logging.StreamHandler()  # 콘솔 출력
    ]
)

# 이벤트 객체 생성 (스레드 종료 신호)
stop_event = threading.Event()

# Muse 스트림 실행 함수
def start_muse_stream():
    logging.info("Starting Muse stream as a subprocess...")
    process = subprocess.Popen(['muselsl', 'stream'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return process

# Muse 스트림 종료 함수
def stop_muse_stream(process):
    logging.info("Stopping Muse stream...")
    process.terminate()
    process.wait()

# Muse 스트림을 시작하는 스레드 생성
stream_thread = None

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

# 전처리 함수
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

# EEG 데이터 수집 함수
def collect_eeg_data(duration, sampling_rate=256):
    logging.info("Resolving EEG stream...")
    try:
        streams = resolve_stream('type', 'EEG')
        if not streams:
            raise RuntimeError("No EEG streams found. Please ensure Muse is streaming.")
    except RuntimeError as e:
        print(f"Error: {e}")
        return None

    inlet = StreamInlet(streams[0])

    logging.info("EEG stream resolved. Collecting data...")
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

# 실시간 졸음 탐지 (진동 횟수 및 졸음 시간 계산 포함)
def real_time_drowsiness_detection(thresholds, duration_minutes, sampling_rate=256):
    theta_alpha_threshold, theta_beta_threshold = thresholds
    drowsy_events = []
    awake_events = []
    vibration_count = 0  # 진동 횟수 카운트 변수

    start_time = time.time()
    end_time = start_time + duration_minutes * 60

    while time.time() < end_time:
        logging.info("Collecting EEG data for 5 seconds...")
        eeg_data = collect_eeg_data(duration=5)
        if eeg_data is None or eeg_data.shape[0] == 0:
            logging.error("Failed to collect EEG data. Skipping this cycle.")
            continue

        preprocessed_data = preprocess_eeg(eeg_data)
        theta_alpha, theta_beta = extract_features(preprocessed_data)

        timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
        if theta_alpha > theta_alpha_threshold or theta_beta > theta_beta_threshold:
            logging.info(f"졸음이 감지되었습니다! 시간: {timestamp}")
            drowsy_events.append({"Timestamp": timestamp, "Theta/Alpha": theta_alpha, "Theta/Beta": theta_beta})
            vibration_count += 1  # 졸음이 감지되면 진동 횟수 증가
            send_to_arduino('1', vibration_intensity)  # 진동 신호와 강도를 아두이노로 전송
            logging.info(f"Data sent to Arduino at {time.time()}.")
        else:
            logging.info(f"Awake at {timestamp}. Theta/Alpha: {theta_alpha:.2f}, Theta/Beta: {theta_beta:.2f}")
            awake_events.append({"Timestamp": timestamp, "Theta/Alpha": theta_alpha, "Theta/Beta": theta_beta})
            send_to_arduino('0', 0)  # 졸음이 감지되지 않으면 진동을 끔

    #total_time = time.time() - start_time  # 총 학습 시간 (초)
    total_time = duration_minutes * 60
    total_drowsy_time = vibration_count * 5  # 진동 횟수 당 5초로 가정
    total_awake_time = total_time - total_drowsy_time  # 집중한 시간

    save_and_visualize(drowsy_events, awake_events)

    # JSON 파일 저장 경로 설정
    timestamp = time.strftime("%Y%m%d_%H%M%S", time.localtime())  # 실행 시점의 타임스탬프 추가
    json_filename = f"drowsiness_result_{timestamp}.json"  # 고유한 파일 이름 생성
    json_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), json_filename)



    # JSON 형식으로 결과 출력
    result = {
        "totalVibrationCount": vibration_count,
        "totalDrowsyTime": total_drowsy_time,
        "totalTime": total_time,
        "totalAwakeTime": total_awake_time,
        "graphImageFilename": "drowsiness_detection_plot.png",  # 저장된 그래프 이미지 파일 이름
        "jsonFilename": json_filename
    }
    print(json.dumps(result))

    # JSON 파일 저장 직전 로그 추가
    logging.info(f"Saving JSON file to: {json_path}")
    logging.info(f"Detection result: {json.dumps(result)}")  # 로그 파일에 기록

    # 결과를 JSON 파일로 저장
    with open(json_path, "w") as json_file:
        json.dump(result, json_file, indent=4)
    logging.info("Results saved to 'drowsiness_result.json'.")


# 결과 저장 및 시각화
def save_and_visualize(drowsy_events, awake_events):
    if drowsy_events:
        drowsy_df = pd.DataFrame(drowsy_events)
        drowsy_df.to_csv("drowsy_log.csv", index=False)
        logging.info("Drowsy log saved to 'drowsy_log.csv'.")

    if awake_events:
        awake_df = pd.DataFrame(awake_events)
        awake_df.to_csv("awake_log.csv", index=False)
        logging.info("Awake log saved to 'awake_log.csv'.")

    visualize_results(drowsy_events, awake_events)

# 시각화 (+이미지 저장)
def visualize_results(drowsy_events, awake_events):
    plt.figure(figsize=(14, 7))

    if drowsy_events:
        drowsy_timestamps = [event["Timestamp"] for event in drowsy_events]
        drowsy_theta_alpha = [event["Theta/Alpha"] for event in drowsy_events]
        drowsy_theta_beta = [event["Theta/Beta"] for event in drowsy_events]
        plt.scatter(drowsy_timestamps, drowsy_theta_alpha, color='red', label='Drowsy Theta/Alpha', alpha=0.7)
        plt.scatter(drowsy_timestamps, drowsy_theta_beta, color='darkred', label='Drowsy Theta/Beta', alpha=0.7)

    if awake_events:
        awake_timestamps = [event["Timestamp"] for event in awake_events]
        awake_theta_alpha = [event["Theta/Alpha"] for event in awake_events]
        awake_theta_beta = [event["Theta/Beta"] for event in awake_events]
        plt.scatter(awake_timestamps, awake_theta_alpha, color='blue', label='Awake Theta/Alpha', alpha=0.7)
        plt.scatter(awake_timestamps, awake_theta_beta, color='darkblue', label='Awake Theta/Beta', alpha=0.7)

    plt.xticks(rotation=45)
    plt.xlabel("Timestamp")
    plt.ylabel("Ratio")
    plt.title("Real-Time Drowsiness Detection")
    plt.legend()
    plt.tight_layout()

    image_filename = os.path.join("results", "drowsiness_detection_plot.png")
    plt.savefig(image_filename)
    logging.info(f"Graph saved to '{image_filename}'.")
    plt.show()

# 메인 함수 - 명령줄 인자를 통해 학습 시간과 진동 강도 전달 받음
if __name__ == "__main__":
    if len(sys.argv) != 3:
        logging.error("Usage: python3 detect_eeg.py <duration_minutes> <vibration_intensity>")
        sys.exit(1)

    duration_minutes = int(sys.argv[1])
    vibration_intensity = int(sys.argv[2])

    thresholds = (3.50, 3.08)  # 사용자 맞춤 임곗값  (Theta/Alpha, Theta/Beta)

    stream_thread = threading.Thread(target=start_muse_stream)
    stream_thread.start()
    time.sleep(2)

    try:
        if 1 <= duration_minutes <= 60:
            real_time_drowsiness_detection(thresholds, duration_minutes=duration_minutes)
        else:
            logging.error("Please enter a valid duration between 1 and 60.")
    except RuntimeError as e:
        logging.error(f"Error: {e}")
    finally:
        stop_event.set()
        stream_thread.join()
        logging.info("Stopping Muse stream...")