"""Live text sentiment analysis."""
from fastapi import APIRouter, Depends

from auth import get_current_user
from models import AnalyzeRequest
from sentiment import score_text

router = APIRouter(prefix="/api/analyze", tags=["analyze"])


@router.post("")
def analyze(payload: AnalyzeRequest, _user: dict = Depends(get_current_user)) -> dict:
    return score_text(payload.text)
