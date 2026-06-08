USE stock_db;

-- 프로필 사진 기능에 필요한 컬럼 확인
SHOW COLUMNS FROM users LIKE 'profile_image_path';
SHOW COLUMNS FROM users LIKE 'google_picture_url';

-- 위 결과가 비어 있으면 SQL/add_profile_columns.sql 을 실행하세요.
-- (이미 컬럼이 있으면 Duplicate column 오류가 나므로 그때는 무시해도 됩니다.)
