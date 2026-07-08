// ===== Firebase 設定 =====
//
// 端末間の自動同期を使うには、無料の Firebase プロジェクトを1つ作り、
// 下の値を自分のプロジェクトのものに書き換えてください。
// （詳しい手順は SYNC-SETUP.md を参照）
//
// ※ここに入る apiKey などは「Web用の公開設定」で、秘密情報ではありません。
//   実際のアクセス制御は Firestore のセキュリティルールで行います。
//   そのままGitHubに置いて（コミットして）問題ありません。

export const firebaseConfig = {
  apiKey:            "PASTE_YOUR_API_KEY",
  authDomain:        "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId:         "PASTE_YOUR_PROJECT_ID",
  storageBucket:     "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId:             "PASTE_YOUR_APP_ID"
};

// 設定が未入力かどうかを判定（未設定なら同期機能は自動的にオフになります）
export function isConfigured() {
  return !Object.values(firebaseConfig).some(v => typeof v === 'string' && v.startsWith('PASTE_'));
}
