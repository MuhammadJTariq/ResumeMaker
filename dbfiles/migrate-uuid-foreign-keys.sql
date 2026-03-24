ALTER TABLE resumes DROP FOREIGN KEY fk_resumes_user;
ALTER TABLE ResumeTemplates DROP FOREIGN KEY fk_templates_user;

ALTER TABLE users
  MODIFY COLUMN id CHAR(36) NOT NULL;

ALTER TABLE resumes
  MODIFY COLUMN user_id CHAR(36) NULL;

ALTER TABLE ResumeTemplates
  MODIFY COLUMN user_id CHAR(36) NULL;

ALTER TABLE resumes
  ADD CONSTRAINT fk_resumes_user
  FOREIGN KEY (user_id) REFERENCES users(id)
  ON DELETE SET NULL;

ALTER TABLE ResumeTemplates
  ADD CONSTRAINT fk_templates_user
  FOREIGN KEY (user_id) REFERENCES users(id)
  ON DELETE SET NULL;
