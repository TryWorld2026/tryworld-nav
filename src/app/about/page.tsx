import type { Metadata } from 'next';
import { ProsePage } from '@/components/prose-page';
import { allCategories, SITE, tools } from '@/lib/data';
import { canonical } from '@/lib/canonical';

export const metadata: Metadata = {
  ...canonical("/about"),
  title: '关于我们',
  description: '试界导航是一个专注于智能体和 AI 工具的门户网站。',
};

export default function AboutPage() {
  return (
    <ProsePage
      title="关于我们"
      intro="工欲善其事，必先利其器。试界导航是专注于智能体和AI工具的门户网站，我们致力于为用户介绍最新、热门的智能体和AI工具，帮助用户快速找到适合自己的学习、工作、生活的AI利器。"
    >
      <h2>我们是谁</h2>
      <p>
        {SITE.name}是一个开放的 AI 工具导航与发现平台。我们持续收录市面上活跃的
        智能体、AI 应用与效率工具，按照使用场景进行分类整理，让每一次「找一个
        合适的 AI 工具」都不再从零开始。
      </p>
      <p>
        截至目前，站点已收录 <strong>{tools.length}</strong> 个工具，
        覆盖 <strong>{allCategories.length}</strong> 个分类，包括 AI 智能体、
        聊天助手、写作、图像设计、视频动画、代码编程、音频音乐、PPT 制作、
        搜索引擎、数据分析、学术研究等方向。
      </p>

      <h2>我们做什么</h2>
      <ul>
        <li>持续收录与更新：跟踪新发布的 AI 产品，及时补充进分类体系。</li>
        <li>按场景组织：以「你想做什么」而非「它是什么技术」为第一分类维度。</li>
        <li>
          保持轻量：<strong>没有账号体系</strong>，也不需要登录；工具可以收藏到本机
          （「我的收藏」，数据只存在你的浏览器里），打开即用。
        </li>
        <li>信息中立：收录不等于推荐，排序仅反映收录与更新顺序。</li>
      </ul>

      <h2>收录原则</h2>
      <p>
        我们优先收录可以公开访问、有明确功能介绍的产品。对于需要邀请码、已停止
        服务或存在明显安全风险的产品，我们会下架处理。若你发现收录信息有误，
        欢迎通过下方的联系方式告诉我们。
      </p>

      <h2>联系我们</h2>
      <p>
        内容纠错、下架请求或功能建议：<strong>在线提交入口尚未开放</strong>，此前不提供
        表单，也不设置指向空页面的「提交工具」链接。渠道开放后会在本页与页脚同时上线，
        在此之前请先以你看到本页的途径联系维护者。
      </p>
      <p>
        本站不接广告，也不出售任何位置的排序。少数工具的「访问官网」由产品方提供的
        分发链接承接，与本站的收录顺序无关；如你在意，可自行搜索产品名进入官网。
      </p>
    </ProsePage>
  );
}
