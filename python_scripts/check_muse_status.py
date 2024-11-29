from muselsl import list_muses

def check_muse_status():
    """Muse 착용 상태를 확인하는 함수"""
    muses = list_muses()
    if not muses:
        return False  # Muse가 연결되지 않음
    return True  # Muse가 연결됨

if __name__ == "__main__":
    status = check_muse_status()
    print("Muse 착용 상태:", "착용됨" if status else "착용되지 않음")