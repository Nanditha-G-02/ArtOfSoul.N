export type Track = "pencil" | "painting";
export type Medium = "graphite" | "oil" | "acrylic" | "watercolor";
export type SkillStatus = "not_assessed" | "in_progress" | "needs_practice" | "proficient";

export interface User { id: number; email: string; display_name: string; created_at: string }
export interface Profile {
  track: Track | null; medium: Medium | null; goals: string; experience: string;
  preferred_subjects: string[]; strengths: string[]; difficulties: string[]; weekly_hours: number;
  teaching_style: string; onboarding_complete: boolean; diagnostic_status: string; memory_notes: string; updated_at: string;
}
export interface Course {
  id: number; institution: string; country: string; course_code: string; title: string; track: string; media: string[];
  level: string; summary: string; objectives: string[]; source_url: string; source_type: string;
  verification: "verified" | "partial"; access_info: string; licensing: string; last_reviewed: string;
  skill_links?: { skill: string; provenance: string }[];
}
export interface Lesson {
  id: number; position: number; stage_index: number; stage_title: string; module_title: string; title: string;
  objectives: string[]; skill_slugs: string[]; prerequisite_slugs: string[]; studio_assignment: string;
  exercises: { title: string; brief: string }[]; assessment_criteria: string[]; source_course_ids: number[];
  est_minutes: number; is_milestone: boolean; kind: "core" | "remedial" | "carried";
  status: "upcoming" | "current" | "completed" | "skipped"; completed_at: string | null;
}
export interface Syllabus {
  id: number; version: number; status: string; goal: string; track: Track; medium: Medium | null; title: string;
  overview: string; expected_outcomes: string[]; milestones: { lesson_position: number; title: string }[];
  change_summary: string; model: string; created_at: string; lessons: Lesson[]; sources: Course[];
}
export interface RoadmapChange { type: string; lesson: string; before?: string; reason: string; evidence_ids: number[] }
export interface Roadmap {
  syllabus: { id: number; title: string; version: number };
  stages: { index: number; title: string; lessons: Lesson[] }[];
  skills: { slug: string; name: string; status: SkillStatus; prerequisites: string[] }[];
  versions: { version: number; trigger: string; summary: string; changes: RoadmapChange[]; created_at: string }[];
  assessments: { id: number; created_at: string; ratings: number; suitable: boolean }[];
  remaining_minutes: number;
}
export interface Artwork {
  id: number; kind: string; title: string; track: Track; medium: Medium | null; width: number; height: number;
  exercise_context: string; lesson_id: number | null; reference_artwork_id: number | null; created_at: string; url: string;
  analysis_count?: number;
}
export interface Observation { dimension: string; observation: string; location: string; confidence: "low" | "medium" | "high" }
export interface Analysis {
  id: number; artwork_id: number; region: { x: number; y: number; w: number; h: number } | null; image_suitable: boolean;
  limitations: string[]; observations: Observation[];
  strengths: { point: string; observation_ids: number[] }[];
  improvements: { issue: string; reason: string; skill_slug: string; observation_ids: number[] }[];
  corrective_steps: string[]; exercises: { title: string; brief: string; skill_slug: string }[];
  suggested_lessons: { lesson_id: number; title: string }[]; next_milestone: string;
  skill_ratings: { skill_slug: string; rating: string; observation_ids: number[]; note: string }[];
  reference_comparison: string; model_vision: string; model_assessment: string; created_at: string;
  artwork?: Artwork;
}
export interface Exercise {
  id: number; kind: "exercise" | "project"; skill_slugs: string[]; title: string; objective: string; instructions: string[];
  materials: string[]; difficulty: string; est_minutes: number; evaluation_criteria: string[]; hints: string[];
  completion_requirements: string[]; milestones: { title: string; deliverable: string; check: string }[];
  reference_suggestion: string; rationale: string; status: string; model: string; created_at: string;
}
export interface Reference { id: number; purpose: string; prompt: string; model: string; created_at: string; url: string; label: string }
export interface Message {
  id: number; role: "user" | "assistant"; content: string; created_at: string;
  meta: { workflow?: string; route?: string; model?: string; sources?: { id: number; title: string; url: string; provenance: string }[] };
  reference?: Reference; exercise?: Exercise;
}
export interface SkillRow {
  slug: string; name: string; domain: string; tier: number; track: string; prerequisites: string[];
  status: SkillStatus; explanation: string; evidence_count: number; user_override: boolean;
}
export type AiStatus = Record<string, { provider: string; model: string; configured: boolean }>;
