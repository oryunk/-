/**
 * mascot2 경로 헬퍼 — 루미콘(이모티콘) vs misc(연출·일러스트)
 */
(function (global) {
  var VER = '20260608s';
  var LUMICON_FILES = {
    'happy.png': true,
    'excited.png': true,
    'curious.png': true,
    'success.png': true,
    'surprised.png': true,
    'sparkle.png': true,
    'hello.png': true,
    'struggling.png': true,
    'sleepy.png': true,
    'thinking.png': true,
    'angry.png': true,
    'chart-analysis.png': true,
    'good-idea.png': true,
    'idea.png': true,
    'studying.png': true,
  };

  function withVer(path) {
    return path + '?v=' + VER;
  }

  function lumiconAsset(name) {
    return withVer('assets/mascot2/' + name);
  }

  function miscAsset(name) {
    return withVer('assets/mascot2/misc/' + name);
  }

  function resolveAsset(name) {
    return LUMICON_FILES[name] ? lumiconAsset(name) : miscAsset(name);
  }

  global.JURIN_MASCOT2_VER = VER;
  global.jurinLumiconAsset = lumiconAsset;
  global.jurinMascot2MiscAsset = miscAsset;
  global.jurinMascot2Asset = resolveAsset;
})(typeof window !== 'undefined' ? window : this);
