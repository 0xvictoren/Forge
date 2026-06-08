export type Locale = "en" | "ko" | "zh" | "fr";

export const LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "fr", label: "Français" },
];

type Dict = Record<string, string>;

const en: Dict = {
  nav_home: "Home",
  nav_wallet: "Wallet",
  nav_messages: "Messages",
  nav_creators: "Creators",
  share_work: "Share Work",
  connect_wallet: "Connect Wallet",
  platform_fee: "Platform fee",
  pay_unlock: "Pay {amount} APT + Unlock",
  owner_free: "Open your file (free)",
  full_to_creator: "Full {amount} APT goes to creator",
  new_message: "New message",
  search_username: "Search by @handle…",
  following: "Following",
  no_users: "No users found",
};

const ko: Dict = {
  nav_home: "홈",
  nav_wallet: "지갑",
  nav_messages: "메시지",
  nav_creators: "크리에이터",
  share_work: "작업 공유",
  connect_wallet: "지갑 연결",
  platform_fee: "플랫폼 수수료",
  pay_unlock: "{amount} APT 결제 후 잠금 해제",
  owner_free: "내 파일 열기 (무료)",
  full_to_creator: "크리에이터에게 {amount} APT 전액 지급",
  new_message: "새 메시지",
  search_username: "@핸들로 검색…",
  following: "팔로잉",
  no_users: "사용자를 찾을 수 없습니다",
};

const zh: Dict = {
  nav_home: "首页",
  nav_wallet: "钱包",
  nav_messages: "消息",
  nav_creators: "创作者",
  share_work: "分享作品",
  connect_wallet: "连接钱包",
  platform_fee: "平台费用",
  pay_unlock: "支付 {amount} APT 并解锁",
  owner_free: "打开你的文件（免费）",
  full_to_creator: "全额 {amount} APT 给创作者",
  new_message: "新消息",
  search_username: "按 @用户名 搜索…",
  following: "关注中",
  no_users: "未找到用户",
};

const fr: Dict = {
  nav_home: "Accueil",
  nav_wallet: "Portefeuille",
  nav_messages: "Messages",
  nav_creators: "Créateurs",
  share_work: "Partager",
  connect_wallet: "Connecter le portefeuille",
  platform_fee: "Frais plateforme",
  pay_unlock: "Payer {amount} APT + déverrouiller",
  owner_free: "Ouvrir votre fichier (gratuit)",
  full_to_creator: "{amount} APT complets au créateur",
  new_message: "Nouveau message",
  search_username: "Rechercher par @pseudo…",
  following: "Abonnements",
  no_users: "Aucun utilisateur trouvé",
};

const MAP: Record<Locale, Dict> = { en, ko, zh, fr };

export function t(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
): string {
  const str = MAP[locale][key] ?? MAP.en[key] ?? key;
  if (!vars) return str;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(`{${k}}`, String(v)),
    str
  );
}
