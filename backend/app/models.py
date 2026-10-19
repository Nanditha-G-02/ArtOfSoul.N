"""Relational data model for ArtOfSoul.N.

Provenance vocabulary used across curriculum tables:
  verified    – restated from an official institutional page we reviewed (see Course.source_url)
  inferred    – our mapping of a verified course onto a skill (judgement, not the institution's claim)
  synthesized – original ArtOfSoul.N curriculum content
"""
from datetime import date, datetime, timezone

from sqlalchemy import (JSON, Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text,
                        UniqueConstraint)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def now() -> datetime:
    return datetime.now(timezone.utc)


TRACKS = ("pencil", "painting")
MEDIA = ("graphite", "oil", "acrylic", "watercolor")
SKILL_STATUSES = ("not_assessed", "in_progress", "needs_practice", "proficient")
EVIDENCE_RATINGS = ("needs_work", "developing", "solid")


# ---------------------------------------------------------------- users
class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    profile: Mapped["LearnerProfile"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")


class LearnerProfile(Base):
    __tablename__ = "learner_profiles"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    track: Mapped[str | None] = mapped_column(String(20))
    medium: Mapped[str | None] = mapped_column(String(20))
    goals: Mapped[str] = mapped_column(Text, default="")
    experience: Mapped[str] = mapped_column(Text, default="")
    preferred_subjects: Mapped[list] = mapped_column(JSON, default=list)
    strengths: Mapped[list] = mapped_column(JSON, default=list)
    difficulties: Mapped[list] = mapped_column(JSON, default=list)
    weekly_hours: Mapped[int] = mapped_column(Integer, default=5)
    teaching_style: Mapped[str] = mapped_column(String(40), default="balanced")
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    diagnostic_status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|skipped|complete
    memory_notes: Mapped[str] = mapped_column(Text, default="")  # learner-editable teacher memory
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)

    user: Mapped[User] = relationship(back_populates="profile")


# ---------------------------------------------------------------- curriculum knowledge
class CurriculumVersion(Base):
    __tablename__ = "curriculum_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    version: Mapped[str] = mapped_column(String(20), unique=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Institution(Base):
    __tablename__ = "institutions"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    country: Mapped[str] = mapped_column(String(80), default="")
    kind: Mapped[str] = mapped_column(String(60), default="university")
    website: Mapped[str] = mapped_column(String(300), default="")


class Course(Base):
    """An institutional course record. Also carries the source metadata (one official page per course)."""
    __tablename__ = "courses"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(60), unique=True)
    institution_id: Mapped[int] = mapped_column(ForeignKey("institutions.id"))
    course_code: Mapped[str] = mapped_column(String(40), default="")
    title: Mapped[str] = mapped_column(String(200))
    track: Mapped[str] = mapped_column(String(20))  # pencil|painting|both
    media: Mapped[list] = mapped_column(JSON, default=list)
    level: Mapped[str] = mapped_column(String(80), default="advanced")
    summary: Mapped[str] = mapped_column(Text)  # our paraphrase of the official description
    objectives: Mapped[list] = mapped_column(JSON, default=list)  # paraphrased
    source_url: Mapped[str] = mapped_column(String(500))
    source_type: Mapped[str] = mapped_column(String(60))
    access_info: Mapped[str] = mapped_column(String(300), default="")
    licensing: Mapped[str] = mapped_column(String(300), default="")
    verification: Mapped[str] = mapped_column(String(20), default="verified")  # verified|partial
    last_reviewed: Mapped[date] = mapped_column(Date)
    curriculum_version_id: Mapped[int | None] = mapped_column(ForeignKey("curriculum_versions.id"))

    institution: Mapped[Institution] = relationship()


class Skill(Base):
    __tablename__ = "skills"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    track: Mapped[str] = mapped_column(String(20))  # pencil|painting|both
    domain: Mapped[str] = mapped_column(String(60))
    description: Mapped[str] = mapped_column(Text)
    tier: Mapped[int] = mapped_column(Integer, default=1)  # 0 prerequisite refresher, 1 core advanced, 2 mastery, 3 capstone
    media: Mapped[list] = mapped_column(JSON, default=list)  # empty = medium-agnostic


class SkillPrerequisite(Base):
    __tablename__ = "skill_prerequisites"
    __table_args__ = (UniqueConstraint("skill_id", "prerequisite_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), index=True)
    prerequisite_id: Mapped[int] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"))


class CourseSkillLink(Base):
    __tablename__ = "course_skill_links"
    __table_args__ = (UniqueConstraint("course_id", "skill_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), index=True)
    provenance: Mapped[str] = mapped_column(String(20), default="inferred")
    rationale: Mapped[str] = mapped_column(String(300), default="")


class CurriculumModule(Base):
    __tablename__ = "curriculum_modules"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    track: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text)
    order: Mapped[int] = mapped_column(Integer, default=0)
    provenance: Mapped[str] = mapped_column(String(20), default="synthesized")


class LearningObjective(Base):
    __tablename__ = "learning_objectives"
    id: Mapped[int] = mapped_column(primary_key=True)
    module_id: Mapped[int] = mapped_column(ForeignKey("curriculum_modules.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(Text)
    provenance: Mapped[str] = mapped_column(String(20), default="synthesized")


class ExerciseTemplate(Base):
    __tablename__ = "exercise_templates"
    id: Mapped[int] = mapped_column(primary_key=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    brief: Mapped[str] = mapped_column(Text)
    media: Mapped[list] = mapped_column(JSON, default=list)
    est_minutes: Mapped[int] = mapped_column(Integer, default=60)
    provenance: Mapped[str] = mapped_column(String(20), default="synthesized")


class AssessmentRubric(Base):
    __tablename__ = "assessment_rubrics"
    id: Mapped[int] = mapped_column(primary_key=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), index=True)
    criterion: Mapped[str] = mapped_column(String(200))
    needs_work: Mapped[str] = mapped_column(Text)
    developing: Mapped[str] = mapped_column(Text)
    solid: Mapped[str] = mapped_column(Text)
    visually_assessable: Mapped[bool] = mapped_column(Boolean, default=True)


# ---------------------------------------------------------------- personalised learning
class Syllabus(Base):
    __tablename__ = "syllabi"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active|archived
    goal: Mapped[str] = mapped_column(Text)
    track: Mapped[str] = mapped_column(String(20))
    medium: Mapped[str | None] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(200))
    overview: Mapped[str] = mapped_column(Text, default="")
    expected_outcomes: Mapped[list] = mapped_column(JSON, default=list)
    milestones: Mapped[list] = mapped_column(JSON, default=list)
    source_course_ids: Mapped[list] = mapped_column(JSON, default=list)
    change_summary: Mapped[str] = mapped_column(Text, default="")
    model: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    lessons: Mapped[list["Lesson"]] = relationship(back_populates="syllabus", cascade="all, delete-orphan",
                                                   order_by="Lesson.position")


class Lesson(Base):
    __tablename__ = "lessons"
    id: Mapped[int] = mapped_column(primary_key=True)
    syllabus_id: Mapped[int] = mapped_column(ForeignKey("syllabi.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    stage_index: Mapped[int] = mapped_column(Integer, default=0)
    stage_title: Mapped[str] = mapped_column(String(160))
    module_title: Mapped[str] = mapped_column(String(160))
    title: Mapped[str] = mapped_column(String(200))
    objectives: Mapped[list] = mapped_column(JSON, default=list)
    skill_slugs: Mapped[list] = mapped_column(JSON, default=list)
    prerequisite_slugs: Mapped[list] = mapped_column(JSON, default=list)
    studio_assignment: Mapped[str] = mapped_column(Text, default="")
    exercises: Mapped[list] = mapped_column(JSON, default=list)
    assessment_criteria: Mapped[list] = mapped_column(JSON, default=list)
    source_course_ids: Mapped[list] = mapped_column(JSON, default=list)
    est_minutes: Mapped[int] = mapped_column(Integer, default=90)
    is_milestone: Mapped[bool] = mapped_column(Boolean, default=False)
    kind: Mapped[str] = mapped_column(String(20), default="core")  # core|remedial|carried
    status: Mapped[str] = mapped_column(String(20), default="upcoming")  # upcoming|current|completed|skipped
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    syllabus: Mapped[Syllabus] = relationship(back_populates="lessons")


class RoadmapVersion(Base):
    __tablename__ = "roadmap_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    syllabus_id: Mapped[int] = mapped_column(ForeignKey("syllabi.id", ondelete="CASCADE"))
    version: Mapped[int] = mapped_column(Integer)
    trigger: Mapped[str] = mapped_column(String(40))  # syllabus_created|assessment|manual|syllabus_revised
    summary: Mapped[str] = mapped_column(Text)
    changes: Mapped[list] = mapped_column(JSON, default=list)  # [{type, lesson, reason, evidence_ids}]
    snapshot: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Artwork(Base):
    __tablename__ = "artworks"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20), default="learner")  # learner|reference
    title: Mapped[str] = mapped_column(String(200), default="Untitled study")
    track: Mapped[str] = mapped_column(String(20))
    medium: Mapped[str | None] = mapped_column(String(20))
    stored_name: Mapped[str] = mapped_column(String(120))
    mime: Mapped[str] = mapped_column(String(40))
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    exercise_context: Mapped[str] = mapped_column(Text, default="")
    lesson_id: Mapped[int | None] = mapped_column(ForeignKey("lessons.id", ondelete="SET NULL"))
    reference_artwork_id: Mapped[int | None] = mapped_column(ForeignKey("artworks.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ArtworkAnalysis(Base):
    __tablename__ = "artwork_analyses"
    id: Mapped[int] = mapped_column(primary_key=True)
    artwork_id: Mapped[int] = mapped_column(ForeignKey("artworks.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    region: Mapped[dict | None] = mapped_column(JSON)  # {x,y,w,h} as fractions, optional focus region
    image_suitable: Mapped[bool] = mapped_column(Boolean, default=True)
    limitations: Mapped[list] = mapped_column(JSON, default=list)
    observations: Mapped[list] = mapped_column(JSON, default=list)
    strengths: Mapped[list] = mapped_column(JSON, default=list)
    improvements: Mapped[list] = mapped_column(JSON, default=list)
    corrective_steps: Mapped[list] = mapped_column(JSON, default=list)
    exercises: Mapped[list] = mapped_column(JSON, default=list)
    suggested_lessons: Mapped[list] = mapped_column(JSON, default=list)
    next_milestone: Mapped[str] = mapped_column(Text, default="")
    skill_ratings: Mapped[list] = mapped_column(JSON, default=list)
    reference_comparison: Mapped[str] = mapped_column(Text, default="")
    model_vision: Mapped[str] = mapped_column(String(120), default="")
    model_assessment: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SkillEvidence(Base):
    """Assessment history: every rating of a skill and where it came from."""
    __tablename__ = "skill_evidence"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), index=True)
    source: Mapped[str] = mapped_column(String(30))  # artwork_analysis|diagnostic|self_report|lesson
    analysis_id: Mapped[int | None] = mapped_column(ForeignKey("artwork_analyses.id", ondelete="SET NULL"))
    rating: Mapped[str] = mapped_column(String(20))
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SkillState(Base):
    __tablename__ = "skill_states"
    __table_args__ = (UniqueConstraint("user_id", "skill_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(20), default="not_assessed")
    evidence_count: Mapped[int] = mapped_column(Integer, default=0)
    user_override: Mapped[bool] = mapped_column(Boolean, default=False)
    explanation: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200), default="Studio session")
    lesson_id: Mapped[int | None] = mapped_column(ForeignKey("lessons.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    messages: Mapped[list["Message"]] = relationship(cascade="all, delete-orphan", order_by="Message.id")


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(20))  # user|assistant
    content: Mapped[str] = mapped_column(Text)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Exercise(Base):
    __tablename__ = "exercises"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20), default="exercise")  # exercise|project
    track: Mapped[str] = mapped_column(String(20))
    medium: Mapped[str | None] = mapped_column(String(20))
    skill_slugs: Mapped[list] = mapped_column(JSON, default=list)
    title: Mapped[str] = mapped_column(String(200))
    objective: Mapped[str] = mapped_column(Text)
    instructions: Mapped[list] = mapped_column(JSON, default=list)
    materials: Mapped[list] = mapped_column(JSON, default=list)
    difficulty: Mapped[str] = mapped_column(String(30))
    est_minutes: Mapped[int] = mapped_column(Integer)
    evaluation_criteria: Mapped[list] = mapped_column(JSON, default=list)
    hints: Mapped[list] = mapped_column(JSON, default=list)
    completion_requirements: Mapped[list] = mapped_column(JSON, default=list)
    milestones: Mapped[list] = mapped_column(JSON, default=list)
    reference_suggestion: Mapped[str] = mapped_column(Text, default="")
    rationale: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="assigned")  # assigned|completed
    model: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GeneratedReference(Base):
    __tablename__ = "generated_references"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[str] = mapped_column(String(40))  # subject|composition|tonal|lighting|palette|inspiration
    prompt: Mapped[str] = mapped_column(Text)
    track: Mapped[str] = mapped_column(String(20))
    stored_name: Mapped[str] = mapped_column(String(120))
    model: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ActivityRecord(Base):
    """Learning history / progress records."""
    __tablename__ = "activity_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    summary: Mapped[str] = mapped_column(Text)
    ref_type: Mapped[str | None] = mapped_column(String(40))
    ref_id: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


class UsageRecord(Base):
    __tablename__ = "ai_usage"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    role: Mapped[str] = mapped_column(String(30))
    provider: Mapped[str] = mapped_column(String(30))
    model: Mapped[str] = mapped_column(String(120))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    ok: Mapped[bool] = mapped_column(Boolean, default=True)
    error: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


Index("ix_evidence_user_skill_time", SkillEvidence.user_id, SkillEvidence.skill_id, SkillEvidence.created_at)
