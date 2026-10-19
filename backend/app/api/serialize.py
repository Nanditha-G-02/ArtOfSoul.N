from .. import models as m
from ..services import media


def user(u: m.User) -> dict:
    return {"id": u.id, "email": u.email, "display_name": u.display_name, "created_at": u.created_at}


def profile(p: m.LearnerProfile) -> dict:
    return {k: getattr(p, k) for k in ("track", "medium", "goals", "experience", "preferred_subjects", "strengths",
                                       "difficulties", "weekly_hours", "teaching_style", "onboarding_complete",
                                       "diagnostic_status", "memory_notes", "updated_at")}


def course(c: m.Course) -> dict:
    return {"id": c.id, "key": c.key, "institution": c.institution.name, "country": c.institution.country,
            "course_code": c.course_code, "title": c.title, "track": c.track, "media": c.media, "level": c.level,
            "summary": c.summary, "objectives": c.objectives, "source_url": c.source_url, "source_type": c.source_type,
            "verification": c.verification, "access_info": c.access_info, "licensing": c.licensing,
            "last_reviewed": c.last_reviewed}


def lesson(l: m.Lesson) -> dict:
    return {k: getattr(l, k) for k in ("id", "position", "stage_index", "stage_title", "module_title", "title", "objectives",
                                       "skill_slugs", "prerequisite_slugs", "studio_assignment", "exercises",
                                       "assessment_criteria", "source_course_ids", "est_minutes", "is_milestone", "kind",
                                       "status", "completed_at")}


def syllabus(s: m.Syllabus) -> dict:
    return {"id": s.id, "version": s.version, "status": s.status, "goal": s.goal, "track": s.track, "medium": s.medium,
            "title": s.title, "overview": s.overview, "expected_outcomes": s.expected_outcomes, "milestones": s.milestones,
            "source_course_ids": s.source_course_ids, "change_summary": s.change_summary, "model": s.model,
            "created_at": s.created_at, "lessons": [lesson(l) for l in sorted(s.lessons, key=lambda x: x.position)]}


def artwork(a: m.Artwork) -> dict:
    return {"id": a.id, "kind": a.kind, "title": a.title, "track": a.track, "medium": a.medium, "width": a.width,
            "height": a.height, "exercise_context": a.exercise_context, "lesson_id": a.lesson_id,
            "reference_artwork_id": a.reference_artwork_id, "created_at": a.created_at,
            "url": media.signed_url("artworks", a.user_id, a.stored_name)}


def analysis(x: m.ArtworkAnalysis) -> dict:
    return {k: getattr(x, k) for k in ("id", "artwork_id", "region", "image_suitable", "limitations", "observations",
                                       "strengths", "improvements", "corrective_steps", "exercises", "suggested_lessons",
                                       "next_milestone", "skill_ratings", "reference_comparison", "model_vision",
                                       "model_assessment", "created_at")}


def exercise(e: m.Exercise) -> dict:
    return {k: getattr(e, k) for k in ("id", "kind", "track", "medium", "skill_slugs", "title", "objective", "instructions",
                                       "materials", "difficulty", "est_minutes", "evaluation_criteria", "hints",
                                       "completion_requirements", "milestones", "reference_suggestion", "rationale",
                                       "status", "model", "created_at", "completed_at")}


def reference(r: m.GeneratedReference) -> dict:
    return {"id": r.id, "purpose": r.purpose, "prompt": r.prompt, "track": r.track, "model": r.model,
            "created_at": r.created_at, "url": media.signed_url("references", r.user_id, r.stored_name),
            "label": "AI-generated reference"}


def message(x: m.Message, user_id: int | None = None) -> dict:
    meta = dict(x.meta or {})
    return {"id": x.id, "role": x.role, "content": x.content, "meta": meta, "created_at": x.created_at}
