import type { Metadata } from 'next';
import { ProsePage } from '@/components/prose-page';
import { SITE } from '@/lib/data';
import { canonical } from '@/lib/canonical';
import { withOg } from '@/lib/og';

export const metadata: Metadata = withOg(
  {
  ...canonical("/privacy-policy"),
  title: '隐私政策',
  description: `${SITE.name} 不收集任何个人身份信息。`,
  },
  '/privacy-policy',
);

export default function PrivacyPage() {
  return (
    <ProsePage
      title="隐私政策"
      intro="我们尽量少地收集数据。当前版本不设账号系统，因此不存在账号相关的个人信息处理。"
    >
      <h2>一、我们不收集什么</h2>
      <ul>
        <li>不要求注册，不收集用户名、手机号、邮箱等账号信息；</li>
        <li>不使用 Cookie 进行用户画像或广告追踪；</li>
        <li>不收集精确地理位置、通讯录或设备标识。</li>
      </ul>

      <h2>二、本地存储</h2>
      <p>
        站点会将你的<strong>收藏列表</strong>（工具名称、简介、图标与主分类）保存在浏览器
        localStorage 中，仅用于在「我的收藏」页展示。该数据不会离开你的设备、不会上传，
        清除浏览器数据或换设备后即消失。
      </p>
      <p>
        本站是单主题站点，没有浅色/深色切换，因此不保存任何主题偏好。
      </p>

      <h2>三、第三方资源</h2>
      <p>
        站内工具图标与截图由本站自行托管（<code>/assets/</code>），不向第三方图片服务
        发起请求。资讯条目由 AIHOT 提供，卡片直接链接到原文，点击后适用对方网站的政策。
      </p>

      <h2>四、外部链接</h2>
      <p>
        站内包含指向第三方网站的链接。点击后你将离开本站点，适用的是对方网站的
        隐私政策，我们建议你在提供个人信息前仔细阅读。
      </p>

      <h2>五、政策更新</h2>
      <p>
        如未来增加需要处理个人信息的功能（例如评论、收藏同步），我们会在功能上线
        前更新本政策并显著提示。
      </p>
    </ProsePage>
  );
}
