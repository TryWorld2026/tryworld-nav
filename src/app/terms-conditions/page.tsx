import type { Metadata } from 'next';
import { ProsePage } from '@/components/prose-page';
import { SITE } from '@/lib/data';

export const metadata: Metadata = {
  title: '用户协议',
  description: `使用 ${SITE.name} 前请阅读以下条款。`,
};

export default function TermsPage() {
  return (
    <ProsePage
      title="用户协议"
      intro="使用本站即表示你已阅读并同意以下条款。如不同意，请停止使用本站。"
    >
      <h2>一、服务说明</h2>
      <p>
        {SITE.name}是一个 AI 工具信息聚合与导航平台，提供工具的名称、简介、图标、
        分类等公开信息的整理与检索服务。站内展示的工具均属于第三方，我们不对其
        可用性、安全性与服务质量作出担保。
      </p>

      <h2>二、账号与使用</h2>
      <p>
        当前版本<strong>不提供账号系统</strong>，你无需注册即可浏览全部内容。
        你不得利用本站从事以下行为：
      </p>
      <ul>
        <li>抓取、复制或再分发本站数据用于商业用途；</li>
        <li>通过自动化手段对站点进行高频请求，影响正常访问；</li>
        <li>发布或传播违法、侵权、骚扰性内容。</li>
      </ul>

      <h2>三、知识产权</h2>
      <p>
        站内工具的商标、图标与截图归其各自权利人所有。本站的页面设计、文案与
        分类体系归本站所有。如你认为站内内容侵犯了你的权益，请联系我们，我们
        会在核实后及时处理。
      </p>

      <h2>四、免责声明</h2>
      <p>
        本站按「现状」提供服务。对于因使用第三方工具造成的任何直接或间接损失，
        本站不承担责任。访问外部链接所产生的行为与本站点无关。
      </p>

      <h2>五、条款变更</h2>
      <p>
        我们可能会根据运营需要修订本协议，修订后的条款将在本页面公布，继续使用
        本站即视为接受修订内容。
      </p>
    </ProsePage>
  );
}
