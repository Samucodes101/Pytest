-- server/src/database/schema.sql
CREATE DATABASE IF NOT EXISTS exam_system;
USE exam_system;

CREATE TABLE departments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(20) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_department_name (name)
);

CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('superadmin', 'admin', 'student') DEFAULT 'student',
    department_id INT,
    avatar VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_department_id (department_id),
    CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

CREATE TABLE exams (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    subject VARCHAR(100),
    department_id INT,
    pass_mark DECIMAL(5,2) DEFAULT 50.00,
    average_threshold DECIMAL(5,2) DEFAULT 75.00,
    duration_minutes INT DEFAULT 60,
    total_marks DECIMAL(5,2) DEFAULT 100.00,
    total_questions INT DEFAULT 0,
    shuffle_questions BOOLEAN DEFAULT TRUE,
    show_answers BOOLEAN DEFAULT TRUE,
    max_violations INT DEFAULT 0 COMMENT '0 = unlimited; otherwise auto-submit when exceeded',
    created_by INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    INDEX idx_created_by (created_by),
    INDEX idx_department_id (department_id),
    INDEX idx_created_at (created_at)
);

CREATE TABLE questions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    exam_id INT NOT NULL,
    question_text TEXT NOT NULL,
    option_a VARCHAR(500) NOT NULL,
    option_b VARCHAR(500) NOT NULL,
    option_c VARCHAR(500) NOT NULL,
    option_d VARCHAR(500) NOT NULL,
    correct_answer CHAR(1) NOT NULL COMMENT 'a, b, c, or d',
    marks DECIMAL(5,2) DEFAULT 1.00,
    difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
    topic VARCHAR(100) NULL,
    order_index INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    INDEX idx_exam_id (exam_id),
    INDEX idx_order (order_index)
);

CREATE TABLE exam_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    exam_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    due_date TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    question_order JSON NULL COMMENT 'Per-candidate shuffled question ids',
    saved_answers JSON NULL COMMENT 'Autosaved in-progress answers',
    violations INT DEFAULT 0 COMMENT 'Tab switches / focus losses during the attempt',
    last_saved_at TIMESTAMP NULL,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_assignment (exam_id, user_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
);

CREATE TABLE results (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    exam_id INT NOT NULL,
    assignment_id INT NOT NULL,
    total_marks DECIMAL(5,2) NOT NULL,
    obtained_marks DECIMAL(5,2) NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    status ENUM('passed', 'failed', 'above_average') NOT NULL,
    time_taken_seconds INT NULL,
    auto_submitted BOOLEAN DEFAULT FALSE,
    violations INT DEFAULT 0,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_result_assignment (assignment_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (assignment_id) REFERENCES exam_assignments(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_exam_id (exam_id),
    INDEX idx_status (status),
    INDEX idx_completed_at (completed_at)
);

CREATE TABLE user_answers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    result_id INT NOT NULL,
    question_id INT NOT NULL,
    selected_answer CHAR(1),
    is_correct BOOLEAN DEFAULT FALSE,
    marks_obtained DECIMAL(5,2) DEFAULT 0,
    FOREIGN KEY (result_id) REFERENCES results(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    INDEX idx_result_id (result_id)
);

CREATE TABLE activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    user_role VARCHAR(20) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NULL,
    entity_id INT NULL,
    details JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity),
    INDEX idx_created_at (created_at)
);

CREATE TABLE settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed data
INSERT INTO settings (setting_key, setting_value) VALUES
('org_name', 'PyTest'),
('org_tagline', 'Customizable Examination System'),
('logo_url', '/pgl-logo.png'),
('primary_color', '#1E5269'),
('allow_registration', 'true');

INSERT INTO departments (name, code) VALUES
('General', 'GEN'),
('Computer Science', 'CSC'),
('Business Administration', 'BUS'),
('Engineering', 'ENG');

INSERT INTO users (name, email, password, role, department_id) VALUES
('Super Admin', 'superadmin@example.com', '$2b$10$dGzY8BfWqVHjKLDpPsJScO5WxUDQFRcFhPLHeNVhwIzPQvR3MyHwS', 'superadmin', NULL),
('Admin User', 'admin@example.com', '$2b$10$dGzY8BfWqVHjKLDpPsJScO5WxUDQFRcFhPLHeNVhwIzPQvR3MyHwS', 'admin', 2),
('John Doe', 'john@example.com', '$2b$10$dGzY8BfWqVHjKLDpPsJScO5WxUDQFRcFhPLHeNVhwIzPQvR3MyHwS', 'student', 2),
('Jane Smith', 'jane@example.com', '$2b$10$dGzY8BfWqVHjKLDpPsJScO5WxUDQFRcFhPLHeNVhwIzPQvR3MyHwS', 'student', 3),
('Bob Wilson', 'bob@example.com', '$2b$10$dGzY8BfWqVHjKLDpPsJScO5WxUDQFRcFhPLHeNVhwIzPQvR3MyHwS', 'student', 4),
('Alice Johnson', 'alice@example.com', '$2b$10$dGzY8BfWqVHjKLDpPsJScO5WxUDQFRcFhPLHeNVhwIzPQvR3MyHwS', 'student', 2),
('Charlie Brown', 'charlie@example.com', '$2b$10$dGzY8BfWqVHjKLDpPsJScO5WxUDQFRcFhPLHeNVhwIzPQvR3MyHwS', 'student', 3);
-- Password for all: "password123"