USE stock_db;

SET @seed_uid := (SELECT user_id FROM users ORDER BY user_id ASC LIMIT 1);

INSERT INTO community_posts (user_id, board, title, body, stock_code, stock_name, view_count, like_count, comment_count, created_at)
SELECT @seed_uid, 'stock', '삼성전자 2분기 실적, 어떻게 보시나요?',
  '2분기 실적 발표 이후 반도체 부문 회복세가 눈에 띄는데, 단기적으로 추가 상승 여력이 있을까요? HBM 수요와 메모리 가격 흐름도 같이 봐야 할 것 같아요.',
  '005930', '삼성전자', 284, 47, 0, DATE_SUB(NOW(), INTERVAL 2 HOUR)
WHERE @seed_uid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM community_posts WHERE title = '삼성전자 2분기 실적, 어떻게 보시나요?' LIMIT 1);

INSERT INTO community_posts (user_id, board, title, body, stock_code, stock_name, view_count, like_count, comment_count, created_at)
SELECT @seed_uid, 'qna', '미국주식 첫 매수, 테슬라 vs 엔비디아 어떤가요?',
  '미국 주식을 처음 시작하려고 합니다. 변동성이 큰 테슬라와 AI 테마의 엔비디아 중 어디부터 공부하면 좋을까요? ETF로 시작하는 것도 고민 중이에요.',
  NULL, NULL, 156, 23, 0, DATE_SUB(NOW(), INTERVAL 5 HOUR)
WHERE @seed_uid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM community_posts WHERE title = '미국주식 첫 매수, 테슬라 vs 엔비디아 어떤가요?' LIMIT 1);

INSERT INTO community_posts (user_id, board, title, body, stock_code, stock_name, view_count, like_count, comment_count, created_at)
SELECT @seed_uid, 'free', '요즘 시장 너무 어렵네요 😅',
  '지수는 오르는데 내 종목만 횡보… 모두들 어떻게 버티고 계신가요? 모의투자로 연습 중인데 실전 감각이 안 잡혀요.',
  NULL, NULL, 412, 89, 0, DATE_SUB(NOW(), INTERVAL 1 DAY)
WHERE @seed_uid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM community_posts WHERE title = '요즘 시장 너무 어렵네요 😅' LIMIT 1);

INSERT INTO community_posts (user_id, board, title, body, stock_code, stock_name, view_count, like_count, comment_count, created_at)
SELECT @seed_uid, 'proof', '모의투자 3개월 +15% 달성 후기',
  '가이드 5단계 따라 모의투자만 3개월 했는데 수익률 15% 나왔어요. 분할 매수와 손절 규칙을 지킨 게 도움이 됐습니다. 초보 분들 참고하세요!',
  NULL, NULL, 523, 112, 0, DATE_SUB(NOW(), INTERVAL 2 DAY)
WHERE @seed_uid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM community_posts WHERE title = '모의투자 3개월 +15% 달성 후기' LIMIT 1);

DELETE FROM community_posts WHERE board = 'notice';
