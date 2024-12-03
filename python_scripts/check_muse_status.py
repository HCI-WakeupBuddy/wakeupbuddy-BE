#check_muse_status.py

from muselsl import list_muses
import sys
sys.stdout.reconfigure(encoding="utf-8")


def check_muse_status():
    """Muse 착용 상태를 확인하는 함수"""
    muses = list_muses()
    if not muses:
        return False  # Muse가 연결되지 않음
    return True  # Muse가 연결됨

if __name__ == "__main__":
    status = check_muse_status()
    if status:
        print("정상 착용")
    else:
        print("착용 안 됨")
