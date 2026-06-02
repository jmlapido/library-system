-- Task 74: school year management
CREATE TABLE IF NOT EXISTS school_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS school_years_school_id_idx ON school_years(school_id);
CREATE INDEX IF NOT EXISTS school_years_is_active_idx ON school_years(is_active);

-- Task 75: class sections
CREATE TABLE IF NOT EXISTS class_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  school_year_id UUID NOT NULL REFERENCES school_years(id),
  name VARCHAR(100) NOT NULL,
  grade_level INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS class_sections_school_id_idx ON class_sections(school_id);
CREATE INDEX IF NOT EXISTS class_sections_year_id_idx ON class_sections(school_year_id);

CREATE TABLE IF NOT EXISTS class_section_teachers (
  section_id UUID NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (section_id, user_id)
);

CREATE TABLE IF NOT EXISTS class_section_students (
  section_id UUID NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (section_id, user_id)
);
