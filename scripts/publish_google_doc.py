from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path

from path_utils import display_path

ROOT_DIR = Path(__file__).resolve().parents[1]
REPORTS_DIR = ROOT_DIR / "reports"
CREDENTIALS_PATH = ROOT_DIR / "credentials" / "credentials.json"
TOKEN_PATH = ROOT_DIR / "token.json"
SCOPES = [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive.file",
]
MISSING_CREDENTIALS_MESSAGE = "Google Docs publishing skipped because credentials are missing."


def find_markdown_report(report_date: str | None = None) -> Path:
    if report_date:
        report_path = REPORTS_DIR / f"{report_date}-portfolio-news-report.md"
        if not report_path.exists():
            raise FileNotFoundError(f"Markdown report not found: {display_path(report_path, ROOT_DIR)}")
        return report_path

    reports = sorted(REPORTS_DIR.glob("*-portfolio-news-report.md"), reverse=True)
    if not reports:
        raise FileNotFoundError("No Markdown portfolio news reports found.")
    return reports[0]


def extract_report_date(report_path: Path) -> str:
    suffix = "-portfolio-news-report.md"
    name = report_path.name
    if not name.endswith(suffix):
        raise ValueError(f"Unexpected report filename: {name}")
    return name.removesuffix(suffix)


def get_google_credentials():
    if not CREDENTIALS_PATH.exists():
        print(MISSING_CREDENTIALS_MESSAGE)
        return None

    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow

    creds = None
    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    elif not creds or not creds.valid:
        flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_PATH), SCOPES)
        creds = flow.run_local_server(port=0)
        TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")

    return creds


def create_google_doc(title: str, content: str, creds) -> str:
    from googleapiclient.discovery import build

    docs_service = build("docs", "v1", credentials=creds)
    drive_service = build("drive", "v3", credentials=creds)

    document = docs_service.documents().create(body={"title": title}).execute()
    document_id = document["documentId"]

    docs_service.documents().batchUpdate(
        documentId=document_id,
        body={
            "requests": [
                {
                    "insertText": {
                        "location": {"index": 1},
                        "text": content,
                    }
                }
            ]
        },
    ).execute()

    file_metadata = (
        drive_service.files()
        .get(fileId=document_id, fields="webViewLink", supportsAllDrives=True)
        .execute()
    )
    return file_metadata.get("webViewLink", f"https://docs.google.com/document/d/{document_id}/edit")


def save_doc_url(report_date: str, doc_url: str) -> Path:
    output_path = REPORTS_DIR / f"{report_date}-google-doc-url.txt"
    output_path.write_text(doc_url + "\n", encoding="utf-8")
    return output_path


def publish_report_to_google_doc(report_date: str | None = None) -> Path | None:
    creds = get_google_credentials()
    if creds is None:
        return None

    report_path = find_markdown_report(report_date)
    actual_report_date = extract_report_date(report_path)
    content = report_path.read_text(encoding="utf-8")
    title = f"Portfolio News Report - {actual_report_date}"
    doc_url = create_google_doc(title, content, creds)
    output_path = save_doc_url(actual_report_date, doc_url)
    print(f"Google Doc URL: {display_path(output_path, ROOT_DIR)}")
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish the latest Markdown report to Google Docs.")
    parser.add_argument("--date", help="Report date in YYYY-MM-DD format. Defaults to the latest report.")
    args = parser.parse_args()
    publish_report_to_google_doc(args.date)


if __name__ == "__main__":
    main()
