import asyncio
import threading
from muselsl import stream, list_muses
from pylsl import StreamInlet, resolve_stream
import time
import numpy as np
import pandas as pd
from scipy.signal import butter, filtfilt, detrend
from mne.preprocessing import ICA
from mne import create_info, EpochsArray
import logging

# 이벤트 객체 생성 (스레드 종료 신호)
stop_event = threading.Event()

# Muse2 스트리밍 시작 함수
def start_muse_stream(muse_id):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        while not stop_event.is_set():
            loop.run_until_complete(stream(muse_id))
    except asyncio.CancelledError:
        pass
    finally:
        loop.close()
        print("Muse stream stopped.")

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

# EEG 데이터 수집 함수
def collect_eeg_data(duration, sampling_rate=256):
    streams = resolve_stream('type', 'EEG')
    inlet = StreamInlet(streams[0])

    data_buffer = []
    start_time = time.time()
    while time.time() - start_time < duration:
        eeg_data, _ = inlet.pull_sample()
        data_buffer.append(eeg_data[:4])  # AUX 채널 제외
        time.sleep(1 / sampling_rate)

    return np.array(data_buffer)

# 데이터 저장 함수
def save_data(data, filename):
    df = pd.DataFrame(data, columns=['TP9', 'AF7', 'AF8', 'TP10'])
    df.to_csv(filename, index=False)

# 데이터 수집 및 저장
def collect_and_save(state, filename):
    print(f"Collecting {state} data for 10 seconds...")
    raw_data = collect_eeg_data(duration=10)
    print(f"Preprocessing {state} data...")
    preprocessed_data = preprocess_eeg(raw_data)

    # 데이터 저장
    save_data(preprocessed_data, filename)
    print(f"{state.capitalize()} data saved to {filename}.")

def main():
    muses = list_muses()
    if not muses:
        print("No Muse devices found. Please connect a Muse device.")
        return

    muse_id = muses[0]['address']
    print(f"Connecting to Muse: {muse_id}")
    
    stream_thread = threading.Thread(target=start_muse_stream, args=(muse_id,))
    stream_thread.start()
    time.sleep(2)

    try:
        state = input("Enter state (awake/drowsy): ").lower()
        if state not in ["awake", "drowsy"]:
            print("Invalid state. Please enter 'awake' or 'drowsy'.")
        else:
            filename = f"{state}_data.csv"
            collect_and_save(state, filename)
    except RuntimeError as e:
        print(f"Error: {e}")
    finally:
        # 스레드 종료 신호 설정
        stop_event.set()
        stream_thread.join()
        print("Stopping Muse stream...")

if __name__ == "__main__":
    # Pylsl 네트워크 로그 억제
    logging.getLogger('pylsl').setLevel(logging.ERROR)
    main()