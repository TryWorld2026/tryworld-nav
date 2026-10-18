/**
 * 收藏（本机）—— 纯函数，零依赖，可被 node 测试直接 import。
 *
 * 为什么不是「登录 + 云端收藏」：这个站是纯静态导出，没有服务端、没有账号
 * 系统。原先页眉右上放着一个「登录/注册」按钮，点开弹窗写着「复刻版本未包含
 * 账号系统，登录与注册暂不可用」—— 首屏视觉权重第二高的元素主动告诉访客
 * 「这是个没做完的复制站」，这是最伤信任的一处（见 work/analysis-ia.md §9②）。
 *
 * 现在的取舍：收藏存在本机 localStorage，并给它一个真正的出口 `/favorites`。
 * 数据不离开浏览器，隐私政策里如实写明。
 *
 * 存储格式有两代，必须都能读：
 *
 *   v1（历史）：`["lovart-ai", "cursor"]`           —— 只有 slug
 *   v2（现在）：`{ "version": 2, "items": [{...}] }` —— 带快照，可离线渲染
 *
 * v1 是 2026-10 之前写入的。用户可能已经存过东西，升级时不能把他们的收藏
 * 静默清空 —— 读到 v1 就转成「只有 slug 的条目」，首次写入时自动落成 v2。
 */

export type FavoriteItem = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  /** 主分类，用于在收藏页显示色点；没有也能渲染。 */
  category?: { slug: string; name: string; color: string };
  /** 加入收藏的时间（ISO）。v1 迁移来的条目没有这个字段。 */
  addedAt?: string;
};

export type FavoriteStore = {
  version: 2;
  items: FavoriteItem[];
};

export const STORAGE_KEY = 'tryworld:favorites';
const MAX_ITEMS = 500;

/** 空 store。每次返回新对象，避免调用方改到共享状态。 */
export function emptyStore(): FavoriteStore {
  return { version: 2, items: [] };
}

/**
 * 解析 localStorage 里的原始字符串。
 *
 * 任何畸形输入都降级成空 store 而不是抛错：隐私模式、被别的脚本写坏、
 * 版本跨代都可能让这里拿到意外内容，而「收藏页白屏」比「收藏丢了」更糟 ——
 * 至少后者用户还能重新点一遍。
 */
export function parseStore(raw: string | null | undefined): FavoriteStore {
  if (!raw) return emptyStore();

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyStore();
  }

  // v1：字符串数组
  if (Array.isArray(data)) {
    const items: FavoriteItem[] = [];
    for (const v of data) {
      if (typeof v !== 'string' || !v.trim()) continue;
      items.push({ slug: v.trim(), name: v.trim(), description: '', icon: '' });
    }
    return { version: 2, items };
  }

  // v2：{ version, items: [] }
  if (data && typeof data === 'object') {
    const obj = data as { version?: unknown; items?: unknown };
    if (!Array.isArray(obj.items)) return emptyStore();
    const items: FavoriteItem[] = [];
    for (const it of obj.items) {
      if (!it || typeof it !== 'object') continue;
      const o = it as Record<string, unknown>;
      if (typeof o.slug !== 'string' || !o.slug.trim()) continue;
      items.push({
        slug: o.slug.trim(),
        name: typeof o.name === 'string' && o.name ? o.name : o.slug,
        description: typeof o.description === 'string' ? o.description : '',
        icon: typeof o.icon === 'string' ? o.icon : '',
        ...(o.category && typeof o.category === 'object'
          ? {
              category: o.category as FavoriteItem['category'],
            }
          : {}),
        ...(typeof o.addedAt === 'string' ? { addedAt: o.addedAt } : {}),
      });
    }
    return { version: 2, items: items.slice(0, MAX_ITEMS) };
  }

  return emptyStore();
}

/** 序列化回 localStorage 的字符串。 */
export function serializeStore(store: FavoriteStore): string {
  return JSON.stringify({ version: 2, items: store.items.slice(0, MAX_ITEMS) });
}

/**
 * 切换一条收藏。
 *
 * - 已存在 → 移除（返回 `{ store, added: false }`）
 * - 不存在 → 插到最前面（返回 `{ store, added: true }`）
 *
 * 「插到最前」而不是追加：收藏页按加入时间倒序展示，新收藏应该在最上面。
 */
export function toggleFavorite(
  store: FavoriteStore,
  item: FavoriteItem,
  now: string = new Date().toISOString(),
): { store: FavoriteStore; added: boolean } {
  const exists = store.items.some((it) => it.slug === item.slug);
  if (exists) {
    return {
      store: { version: 2, items: store.items.filter((it) => it.slug !== item.slug) },
      added: false,
    };
  }
  const next: FavoriteItem = { ...item, addedAt: item.addedAt ?? now };
  return { store: { version: 2, items: [next, ...store.items].slice(0, MAX_ITEMS) }, added: true };
}

/** 是否已收藏。 */
export function isFavorite(store: FavoriteStore, slug: string): boolean {
  return store.items.some((it) => it.slug === slug);
}

/**
 * 同 tab 内「收藏变了」的广播事件名。
 *
 * 为什么需要它：详情页的按钮与 `/favorites` 是两棵独立的 React 树，没有共同的
 * 父组件可以传状态；`localStorage` 的 `storage` 事件又**只在别的标签页**触发。
 * 用自定义事件做最小通知，比引入状态库或 Context Provider 便宜得多。
 */
export const favoritesChangedEvent = 'tryworld:favorites-changed';

/** 读 localStorage 里的收藏。任何异常都降级成空 store（隐私模式会抛）。 */
export function readStore(): FavoriteStore {
  if (typeof window === 'undefined') return emptyStore();
  try {
    return parseStore(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyStore();
  }
}

/** 写回 localStorage 并广播。存储满/被禁用时静默失败，不阻塞界面。 */
export function writeStore(store: FavoriteStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeStore(store));
  } catch {
    /* 隐私模式或配额满：内存里的状态照常更新，只是不持久化 */
  }
  window.dispatchEvent(new Event(favoritesChangedEvent));
}
