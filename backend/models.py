"""Validated request schemas for the Pulse API."""
from __future__ import annotations

import re
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

Platform = Literal["X", "Reddit", "Instagram", "YouTube"]
Topic = Literal["Battery life", "Camera", "Price", "Support", "Delivery", "Design"]
Tone = Literal["positive", "neutral", "negative"]
Status = Literal["New", "Replied", "Resolved"]
Role = Literal["Admin", "Analyst", "Viewer"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class EmailModel(StrictModel):
    email: str = Field(min_length=3, max_length=254)

    @field_validator("email")
    @classmethod
    def valid_email_syntax(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[a-zA-Z0-9-]{2,63}", normalized):
            raise ValueError("Enter a valid email address.")
        return normalized


class SignupRequest(EmailModel):
    password: str = Field(min_length=6, max_length=200)
    name: str = Field(min_length=1, max_length=60)


class LoginRequest(EmailModel):
    password: str = Field(min_length=1, max_length=200)


class AnalyzeRequest(StrictModel):
    text: str = Field(min_length=1, max_length=5000)


class PostCreate(StrictModel):
    text: str = Field(min_length=1, max_length=2000)
    platform: Platform
    topic: Topic


class InboxUpdate(StrictModel):
    status: Status | None = None
    replyText: str | None = Field(default=None, max_length=2000)


class TeamInvite(EmailModel):
    role: Role = "Analyst"
    name: str | None = Field(default=None, max_length=60)


class TeamRole(StrictModel):
    role: Role


class NotificationSettings(StrictModel):
    spike: bool = True
    weekly: bool = True
    tips: bool = False


class ProfileUpdate(StrictModel):
    name: str = Field(min_length=1, max_length=60)
    title: str = Field(default="Product Analyst", max_length=80)
    avatarColor: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    notifications: NotificationSettings = Field(default_factory=NotificationSettings)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Display name cannot be blank.")
        return value.strip()
