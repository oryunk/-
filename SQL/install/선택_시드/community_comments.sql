-- [선택] community_posts 다음 (2/3)
USE stock_db;

SET @seed_uid := (SELECT user_id FROM users ORDER BY user_id ASC LIMIT 1);
SET @post_stock := (SELECT post_id FROM community_posts WHERE title = '삼성전자 2분기 실적, 어떻게 보시나요?' LIMIT 1);
SET @post_free := (SELECT post_id FROM community_posts WHERE title = '요즘 시장 너무 어렵네요 😅' LIMIT 1);

INSERT INTO community_comments (post_id, user_id, body, created_at)
SELECT @post_stock, @seed_uid, '실적은 괜찮아 보이는데 밸류에이션 부담은 여전한 것 같아요. 분할 매수 관점으로 보고 있습니다.', DATE_SUB(NOW(), INTERVAL 90 MINUTE)
WHERE @seed_uid IS NOT NULL AND @post_stock IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM community_comments WHERE post_id = @post_stock AND body LIKE '실적은 괜찮아%' LIMIT 1);

INSERT INTO community_comments (post_id, user_id, body, created_at)
SELECT @post_stock, @seed_uid, 'HBM 수요는 좋다고 하는데 메모리 업황이 얼마나 지속될지가 관건이네요.', DATE_SUB(NOW(), INTERVAL 45 MINUTE)
WHERE @seed_uid IS NOT NULL AND @post_stock IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM community_comments WHERE post_id = @post_stock AND body LIKE 'HBM 수요%' LIMIT 1);

INSERT INTO community_comments (post_id, user_id, body, created_at)
SELECT @post_free, @seed_uid, '저도 비슷해요. 지수만 보고 있어요 😅', DATE_SUB(NOW(), INTERVAL 3 HOUR)
WHERE @seed_uid IS NOT NULL AND @post_free IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM community_comments WHERE post_id = @post_free AND body LIKE '저도 비슷해요%' LIMIT 1);

UPDATE community_posts p
LEFT JOIN (
  SELECT post_id, COUNT(*) AS cnt
  FROM community_comments
  GROUP BY post_id
) AS agg ON agg.post_id = p.post_id
SET p.comment_count = COALESCE(agg.cnt, 0)
WHERE p.post_id > 0;
