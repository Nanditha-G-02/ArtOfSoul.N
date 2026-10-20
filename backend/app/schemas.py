from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

Track = Literal["pencil", "painting"]
Medium = Literal["graphite", "oil", "acrylic", "watercolor"]


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=120)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class ProfileIn(BaseModel):
    track: Track | None = None
    medium: Medium | None = None
    goals: str | None = Field(default=None, max_length=2000)
    experience: str | None = Field(default=None, max_length=2000)
    preferred_subjects: list[str] | None = Field(default=None, max_length=20)
    strengths: list[str] | None = Field(default=None, max_length=20)
    difficulties: list[str] | None = Field(default=None, max_length=20)
    weekly_hours: int | None = Field(default=None, ge=1, le=60)
    teaching_style: Literal["socratic", "direct", "balanced", "demonstration"] | None = None
    memory_notes: str | None = Field(default=None, max_length=4000)
    onboarding_complete: bool | None = None

    @field_validator("preferred_subjects", "strengths", "difficulties")
    @classmethod
    def _trim(cls, v):
        return [s.strip()[:120] for s in v if s.strip()] if v is not None else v


class DiagnosticIn(BaseModel):
    answers: dict[str, Literal["needs_work", "developing", "solid", "unsure"]]
    skip: bool = False


class SyllabusIn(BaseModel):
    goal: str = Field(min_length=2, max_length=600)


class LessonStatusIn(BaseModel):
    status: Literal["current", "completed", "upcoming"]


class MessageIn(BaseModel):
    text: str | None = Field(default=None, max_length=6000)
    action: str | None = None


class ExerciseIn(BaseModel):
    kind: Literal["exercise", "project"] = "exercise"
    focus_skill: str | None = None
    goal: str = Field(default="", max_length=600)
    harder: bool = False


class ReferenceIn(BaseModel):
    purpose: Literal["subject", "composition", "tonal", "lighting", "inspiration"]
    subject: str = Field(min_length=3, max_length=300)
    lighting: str = Field(default="", max_length=200)


class PaletteIn(BaseModel):
    brief: str = Field(min_length=3, max_length=400)


class Region(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    w: float = Field(gt=0.02, le=1)
    h: float = Field(gt=0.02, le=1)


class AnalyzeIn(BaseModel):
    region: Region | None = None


class SkillOverrideIn(BaseModel):
    status: Literal["not_assessed", "in_progress", "needs_practice", "proficient"]
    note: str = Field(default="", max_length=300)
