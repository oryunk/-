// AI 분석 관련 로직

const mockData = {
  '삼성전자': {
    rating: '강력 매수 💚',
    per: '14.2배',
    summary: '반도체 업황 회복과 HBM 수요 급증으로 실적 개선이 기대됩니다. 저평가 구간으로 장기 투자에 유리한 시점입니다.'
  },
  'SK하이닉스': {
    rating: '매수 🟢',
    per: '18.7배',
    summary: 'AI 서버용 HBM4 독점 공급으로 마진 개선이 예상됩니다. 단기 급등에 따른 조정 가능성을 고려해 분할 매수를 권장합니다.'
  },
  'NAVER': {
    rating: '보유 🟡',
    per: '27.3배',
    summary: '커머스·클라우드 성장이 기대되나 현재 밸류에이션이 다소 높습니다. 200,000원 이하에서 비중 확대를 고려해 볼 수 있습니다.'
  }
};

function analyzeStock() {
  // 종목 분석 페이지로 이동
  window.location.href = 'analysis.html';
}

function searchTerm() {
  // 용어 검색 페이지로 이동
  window.location.href = 'glossary.html';
}
