-- Task 76: teacher-referred books
CREATE TYPE IF NOT EXISTS assignment_type AS ENUM ('required', 'optional');

CREATE TABLE IF NOT EXISTS section_book_assignments (
  section_id UUID NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  type assignment_type NOT NULL DEFAULT 'optional',
  assigned_by UUID REFERENCES users(id),
  note VARCHAR(500),
  assigned_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (section_id, book_id)
);

CREATE INDEX IF NOT EXISTS sba_section_id_idx ON section_book_assignments(section_id);
CREATE INDEX IF NOT EXISTS sba_book_id_idx ON section_book_assignments(book_id);

-- Task 77: student interests (stored in users.interests JSONB)
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]';
