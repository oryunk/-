-- 전체 회원 및 연관 데이터 삭제 (개발/테스트용)
-- 실행: mysql ... < SQL/wipe_all_users.sql
-- 또는: python backend/scripts/wipe_all_users.py
USE stock_db;

SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM community_poll_votes;
DELETE FROM community_poll_options;
DELETE FROM community_post_polls;
DELETE FROM community_post_attachments;
DELETE FROM community_comments;
DELETE FROM community_post_likes;
DELETE FROM community_posts;
DELETE FROM support_inquiry_feedback;
DELETE FROM support_inquiry_attachments;
DELETE FROM support_inquiry_replies;
DELETE FROM support_inquiries;
DELETE FROM lumi_chat_messages;
DELETE FROM lumi_chat_threads;
DELETE FROM user_watchlist;
DELETE FROM user_lumicons;
DELETE FROM email_verification_codes;
DELETE FROM virtual_orders;
DELETE FROM virtual_positions;
DELETE FROM virtual_accounts;
DELETE FROM ai_analyses WHERE user_id IS NOT NULL;
DELETE FROM users;

SET FOREIGN_KEY_CHECKS = 1;
