"""Institutional course records used as the curriculum research foundation.

Every entry below was reviewed on the date shown at the official URL listed. Summaries and
objectives are ArtOfSoul.N paraphrases of the institution's published catalog text — never the
institution's own syllabus, and never a claim of endorsement, certification or accreditation.

verification:
  verified – the official page states a description (and objectives where listed) that we paraphrase
  partial  – the official page confirms the course exists but publishes little/no description;
             we record only what is shown and do not invent content for it.

skill links are ArtOfSoul.N's own (provenance = "inferred") mapping of the published description
onto the skill graph.
"""
from datetime import date

REVIEWED = date(2026, 10, 19)

INSTITUTIONS = [
    {"name": "Queens College, City University of New York", "country": "USA", "kind": "university", "website": "https://www.qc.cuny.edu"},
    {"name": "University of Massachusetts Amherst", "country": "USA", "kind": "university", "website": "https://www.umass.edu"},
    {"name": "Utah State University", "country": "USA", "kind": "university", "website": "https://www.usu.edu"},
    {"name": "Cornell University", "country": "USA", "kind": "university", "website": "https://www.cornell.edu"},
    {"name": "Massachusetts Institute of Technology (Student Art Association)", "country": "USA", "kind": "university arts programme", "website": "https://arts.mit.edu"},
    {"name": "Citrus College", "country": "USA", "kind": "community college", "website": "https://www.citruscollege.edu"},
    {"name": "Lehman College, City University of New York", "country": "USA", "kind": "university", "website": "https://www.lehman.cuny.edu"},
    {"name": "Medgar Evers College, City University of New York", "country": "USA", "kind": "university", "website": "https://www.mec.cuny.edu"},
    {"name": "College of San Mateo", "country": "USA", "kind": "community college", "website": "https://collegeofsanmateo.edu"},
    {"name": "West Valley College", "country": "USA", "kind": "community college", "website": "https://www.westvalley.edu"},
    {"name": "Foothill College", "country": "USA", "kind": "community college", "website": "https://foothill.edu"},
    {"name": "Hawaii Pacific University", "country": "USA", "kind": "university", "website": "https://www.hpu.edu"},
    {"name": "The City College of New York, CUNY", "country": "USA", "kind": "university", "website": "https://www.ccny.cuny.edu"},
]

COURSES = [
    {
        "key": "qc-arts-351", "institution": "Queens College, City University of New York",
        "course_code": "ARTS 351", "title": "Advanced Drawing", "track": "pencil", "media": ["graphite"],
        "level": "advanced (BFA)",
        "summary": "A BFA-only, instructor-permission studio in which drawing projects are set both by the instructor and by the student, with independent work reviewed through regular group critique and one-to-one tutorials.",
        "objectives": ["Develop self-initiated drawing projects alongside assigned ones", "Present independent work for group critique", "Refine work through individual tutorials"],
        "source_url": "https://qc-undergraduate.catalog.cuny.edu/courses/0042061",
        "source_type": "official course catalog", "verification": "verified",
        "skills": ["personal-style", "portfolio-project", "composition-hierarchy"],
    },
    {
        "key": "umass-advanced-drawing", "institution": "University of Massachusetts Amherst",
        "course_code": "ART (Advanced Drawing)", "title": "Advanced Drawing", "track": "pencil", "media": ["graphite"],
        "level": "intermediate–advanced",
        "summary": "Aimed at intermediate and advanced students moving from drawing known, observed objects and figures toward a freer, more imaginative statement, across figure, still life, landscape and interior problems in a range of drawing media.",
        "objectives": ["Transition from observed subjects toward imaginative statements", "Work through figure, still-life, landscape and interior problems", "Use varied drawing media"],
        "source_url": "https://www.umass.edu/humanities-arts/class/36940/advanced-drawing",
        "source_type": "official course listing", "verification": "verified",
        "skills": ["expressive-mark-making", "still-life-drawing", "landscape-drawing", "figure-gesture-anatomy", "personal-style"],
    },
    {
        "key": "usu-art-4200", "institution": "Utah State University",
        "course_code": "ART 4200", "title": "Advanced Drawing and Painting Studio", "track": "both", "media": ["graphite", "oil", "acrylic", "watercolor"],
        "level": "advanced (BA/BS/BFA)",
        "summary": "Advanced individual projects in which students produce a series of closely related drawings and paintings, using varied methods, to build a focused, personal portfolio.",
        "objectives": ["Plan and execute a related series of works", "Choose methods suited to a personal direction", "Assemble a focused portfolio"],
        "source_url": "https://catalog.usu.edu/courses/ART4200",
        "source_type": "official course catalog", "verification": "verified",
        "skills": ["portfolio-project", "personal-style", "visual-storytelling"],
    },
    {
        "key": "cornell-art-2501", "institution": "Cornell University",
        "course_code": "ART 2501", "title": "Drawing (BFA gateway)", "track": "pencil", "media": ["graphite"],
        "level": "BFA foundation-to-intermediate",
        "summary": "Introduces entering BFA students to contemporary practice through drawing, treating drawing both as a medium in its own right and as a tool for developing ideas in other media, through technical and conceptual assignments.",
        "objectives": ["Treat drawing as an independent medium", "Use drawing to develop ideas for other media", "Complete technical and conceptual assignments"],
        "source_url": "https://classes.cornell.edu/browse/roster/FA25/class/ART/2501",
        "source_type": "official class roster", "verification": "verified",
        "skills": ["expressive-mark-making", "observational-drawing", "composition-hierarchy"],
    },
    {
        "key": "mit-saa-intro-drawing", "institution": "Massachusetts Institute of Technology (Student Art Association)",
        "course_code": "SAA (non-credit)", "title": "Introduction to Drawing", "track": "pencil", "media": ["graphite"],
        "level": "foundational (used only for prerequisite refreshers)",
        "summary": "A non-credit studio covering mark-making, layering, additive and subtractive drawing and the articulation of line, value, shape, volume, weight, gesture and composition, moving from small observational studies to larger, more complex drawings grounded in realistic rendering.",
        "objectives": ["Build technical control through small observational studies", "Apply layering and additive/subtractive methods", "Scale up to larger, more complex observational drawings"],
        "source_url": "https://arts.mit.edu/saa-classes/sp26-tuesday-introduction-to-drawing/",
        "source_type": "official programme page (non-credit)", "verification": "verified",
        "skills": ["observational-drawing", "value-structure", "layered-graphite"],
    },
    {
        "key": "citrus-art-117", "institution": "Citrus College",
        "course_code": "ART 117", "title": "Figure Drawing III", "track": "pencil", "media": ["graphite"],
        "level": "advanced",
        "summary": "Advanced life drawing addressing structure, proportion, foreshortening, composition and deliberate exaggeration, with complex anatomy, figures placed in perspective space, light-based rendering and portfolio preparation.",
        "objectives": ["Identify complex anatomy of the human form", "Measure and place figures accurately in space", "Resolve foreshortening and structural problems", "Render the figure with light in complex media", "Build a figure-drawing portfolio and critique work"],
        "source_url": "https://catalog.citruscollege.edu/course-outlines/ART-117/",
        "source_type": "official course outline of record", "verification": "verified",
        "skills": ["figure-gesture-anatomy", "facial-anatomy", "hands-complex-forms", "proportion-measurement", "form-construction", "perspective-space", "light-shadow-analysis"],
    },
    {
        "key": "citrus-art-230", "institution": "Citrus College",
        "course_code": "ART 230", "title": "Advanced Painting", "track": "painting", "media": ["oil", "acrylic"],
        "level": "advanced",
        "summary": "Personalised exploration of expressive concepts and techniques in oil and acrylic, applying colour theory, value and composition toward a chosen painting direction, with critical analysis of form and content and series or large-scale work.",
        "objectives": ["Apply colour theory, value and composition to a chosen direction", "Explain the relationship between form and content in one's own work", "Analyse paintings for concept and style", "Produce a series or large-scale painting"],
        "source_url": "https://catalog.citruscollege.edu/course-outlines/ART-230/",
        "source_type": "official course outline of record", "verification": "verified",
        "skills": ["color-relationships", "value-grouping-paint", "composition-hierarchy", "personal-style", "visual-storytelling", "layering-oil", "layering-acrylic"],
    },
    {
        "key": "lehman-art-305", "institution": "Lehman College, City University of New York",
        "course_code": "ART 305", "title": "Advanced Painting", "track": "painting", "media": ["oil", "acrylic"],
        "level": "advanced",
        "summary": "Pictorial representation in oil, acrylic and related materials, developing ideas and objectives for a self-reflective approach to painting; repeatable for credit.",
        "objectives": ["Represent pictorially in oil and acrylic", "Develop self-reflective painting objectives"],
        "source_url": "https://lehman-undergraduate.catalog.cuny.edu/courses/0982451",
        "source_type": "official course catalog", "verification": "verified",
        "skills": ["form-rendering-paint", "personal-style"],
    },
    {
        "key": "mec-art-208", "institution": "Medgar Evers College, City University of New York",
        "course_code": "ART 208", "title": "Painting Techniques", "track": "painting", "media": ["oil", "acrylic", "watercolor"],
        "level": "advanced exploratory",
        "summary": "An advanced exploratory studio and lecture course intensifying painting practice across oil, acrylic and watercolour, with lectures on contemporary art forms.",
        "objectives": ["Intensify technique across oil, acrylic and watercolour", "Relate studio work to contemporary art forms"],
        "source_url": "https://mec.catalog.cuny.edu/courses/0775921",
        "source_type": "official course catalog", "verification": "verified",
        "skills": ["brushwork", "layering-oil", "layering-acrylic", "layering-watercolor"],
    },
    {
        "key": "csm-art-247", "institution": "College of San Mateo",
        "course_code": "ART 247", "title": "Oil Painting IV", "track": "painting", "media": ["oil"],
        "level": "advanced (fourth semester)",
        "summary": "Extends advanced oil techniques with further exploration of personal style, meaning and context, reviewing composition, light theory and colour harmonies through still-life set-ups and block-in-to-finish paintings.",
        "objectives": ["Apply advanced oil techniques", "Construct paintings with strong drawing, composition and colour", "Experiment with advanced styles and media", "Discover personal style and content"],
        "source_url": "https://collegeofsanmateo.edu/articulation/courseoutlines/art/ART247.pdf",
        "source_type": "official course outline (PDF)", "verification": "verified",
        "skills": ["layering-oil", "color-harmony", "still-life-painting", "light-atmosphere-paint", "personal-style", "composition-hierarchy"],
    },
    {
        "key": "wvc-arts-049c", "institution": "West Valley College",
        "course_code": "ARTS 049C", "title": "Intermediate-Advanced Painting", "track": "painting", "media": ["oil", "acrylic"],
        "level": "intermediate–advanced",
        "summary": "Students pursue personal styles while studying advanced composition and colour theory through studio practice and painting history, exploring alternative surfaces and materials alongside traditional approaches.",
        "objectives": ["Pursue a personal style", "Apply advanced composition and colour theory", "Explore alternative surfaces and materials"],
        "source_url": "https://www.westvalley.edu/catalog/courses/art/arts049c.html",
        "source_type": "official course catalog", "verification": "verified",
        "skills": ["color-harmony", "composition-hierarchy", "personal-style", "texture-materials-paint"],
    },
    {
        "key": "foothill-art-47b", "institution": "Foothill College",
        "course_code": "ART 47B", "title": "Watercolor II", "track": "painting", "media": ["watercolor"],
        "level": "intermediate",
        "summary": "Intermediate transparent and opaque watercolour on varied papers, applying value, intensity and chroma to build complex, expressive compositions and a personal series on chosen subjects.",
        "objectives": ["Apply transparent and opaque watercolour techniques on varied supports", "Use colour and design principles to build complex compositions", "Use colour expressively to develop form and movement", "Critique watercolour work with appropriate terminology"],
        "source_url": "https://catalog.foothill.edu/course-outlines/ART-47B/",
        "source_type": "official course outline of record", "verification": "verified",
        "skills": ["layering-watercolor", "color-relationships", "composition-hierarchy", "landscape-painting"],
    },
    {
        "key": "hpu-art-1080", "institution": "Hawaii Pacific University",
        "course_code": "ART 1080", "title": "Transparent Watercolor", "track": "painting", "media": ["watercolor"],
        "level": "mixed (beginner to advanced)",
        "summary": "Examines what distinguishes transparent watercolour as a medium, with emphasis on luminous colour, translucent layering, strong composition and defined form, and personal voice.",
        "objectives": ["Achieve luminous colour", "Build translucent layers", "Develop personal voice"],
        "source_url": "https://catalog.hpu.edu/courses/ART1080",
        "source_type": "official course catalog", "verification": "verified",
        "skills": ["layering-watercolor", "color-harmony"],
    },
    {
        "key": "ccny-arte-6200e", "institution": "The City College of New York, CUNY",
        "course_code": "ARTE 6200E", "title": "Water Color, Advanced", "track": "painting", "media": ["watercolor"],
        "level": "graduate (advanced)",
        "summary": "Graduate-level advanced watercolour course. The official page lists the title and credits only; no description is published, so ArtOfSoul.N records the course's existence and level only.",
        "objectives": [],
        "source_url": "https://ccny-graduate.catalog.cuny.edu/courses/0430531",
        "source_type": "official course catalog", "verification": "partial",
        "skills": ["layering-watercolor"],
    },
]
