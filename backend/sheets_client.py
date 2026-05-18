import os
from functools import lru_cache
from dotenv import load_dotenv
import gspread
from google.oauth2.service_account import Credentials

load_dotenv()

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]


@lru_cache(maxsize=1)
def get_client() -> gspread.Client:
    path = os.getenv("GOOGLE_CREDENTIALS_PATH")
    if not path or not os.path.exists(path):
        raise FileNotFoundError(f"서비스 계정 키 파일을 찾을 수 없습니다: {path}")
    creds = Credentials.from_service_account_file(path, scopes=SCOPES)
    return gspread.authorize(creds)


def get_worksheet(sheet_name: str) -> gspread.Worksheet:
    spreadsheet_id = os.getenv("SPREADSHEET_ID")
    gc = get_client()
    spreadsheet = gc.open_by_key(spreadsheet_id)
    return spreadsheet.worksheet(sheet_name)


def get_all_records(sheet_name: str, header_row: int = 1) -> list[dict]:
    ws = get_worksheet(sheet_name)
    return ws.get_all_records(head=header_row, default_blank="")


def get_all_values(sheet_name: str) -> list[list]:
    ws = get_worksheet(sheet_name)
    return ws.get_all_values()
