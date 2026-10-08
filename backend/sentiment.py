"""VADER scoring with local negation and intensity adjustments."""
from __future__ import annotations

import re
from typing import Any

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_analyzer = SentimentIntensityAnalyzer()
_NEGATORS = {"not", "no", "never", "hardly", "barely", "isn't", "wasn't", "don't", "doesn't", "didn't"}
_INTENSIFIERS = {"really": 1.6, "very": 1.5, "extremely": 1.9, "so": 1.25, "quite": 1.2, "incredibly": 1.7}
_WORD_RE = re.compile(r"[a-z']+", re.IGNORECASE)


def score_text(text: str) -> dict[str, Any]:
    """Return normalized sentiment, label, word highlights and VADER breakdown."""
    source = text.strip()
    tokens = list(_WORD_RE.finditer(source.lower()))
    adjusted_sum = 0.0
    absolute_sum = 0.0
    highlights: list[dict[str, Any]] = []

    for index, match in enumerate(tokens):
        word = match.group(0)
        base = float(_analyzer.lexicon.get(word, 0.0))
        if not base:
            continue
        context = [tokens[position].group(0) for position in range(max(0, index - 3), index)]
        negated = any(token in _NEGATORS for token in context)
        intensity = next((_INTENSIFIERS[token] for token in reversed(context) if token in _INTENSIFIERS), 1.0)
        adjusted = base * intensity * (-0.85 if negated else 1.0)
        adjusted_sum += adjusted
        absolute_sum += abs(base) * intensity
        highlights.append({
            "word": word,
            "sentiment": "positive" if adjusted > 0 else "negative",
            "weight": round(adjusted, 3),
            "start": match.start(),
            "end": match.end(),
        })

    vader = _analyzer.polarity_scores(source)
    contextual = adjusted_sum / ((absolute_sum * absolute_sum + 15.0) ** 0.5) if absolute_sum else 0.0
    if highlights:
        score = max(-1.0, min(1.0, 0.65 * vader["compound"] + 0.35 * contextual))
    else:
        score = float(vader["compound"])
    label = "positive" if score > 0.15 else "negative" if score < -0.15 else "neutral"
    return {
        "score": round(score, 3),
        "label": label,
        "highlighted_words": highlights,
        "words": highlights,
        "breakdown": {key: round(float(value), 3) for key, value in vader.items()},
    }
