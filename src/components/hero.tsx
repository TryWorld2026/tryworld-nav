import { SITE } from '@/lib/data';
import { SiteLogo } from './site-logo';

/**
 * The hero's lead paragraph.
 *
 * Kept separate from `SITE.description` because the two slots want different
 * lengths: this one opens with the 工欲善其事 clause and is allowed to run
 * long, while the `<meta name="description">` tag stays tighter.
 *
 * 句式沿用了原站 hero 的措辞，只换品牌名——这是站点自身的文案而非抓取内容，
 * 若要彻底脱离原站行文，从这里改起。
 */
const HERO_LEAD =
  '工欲善其事，必先利其器。试界导航是专注于智能体和AI工具的门户网站，我们致力于为用户介绍最新、热门的智能体和AI工具，帮助用户快速找到适合自己的学习、工作、生活的AI利器。';

export function Hero() {
  return (
    <section className="pt-10 pb-4 px-4">
      <div className="px-4 bg-background">
        <div className="mb-6">
          <div className="z-10 flex justify-start mb-4">
            <div className="group rounded-full border border-black/5 bg-neutral-100 text-sm text-gray-500 transition-all ease-in hover:cursor-pointer hover:bg-neutral-200">
              <div className="inline-flex items-center justify-center px-4 py-1 transition ease-out hover:text-neutral-600 hover:duration-300">
                <span className="flex items-center">👀 tryworld.com.cn</span>
              </div>
            </div>
          </div>

          <div className="flex">
            <h1 className="text-5xl font-display mb-8 flex items-center">
              {/* 原站这里用的是紫粉橙渐变的主标与渐变裁切文字；试界品牌不定义
                  渐变标识，主标与站名都用深绿纯色。 */}
              <SiteLogo className="w-14 h-auto text-gongke-accent mr-3 shrink-0" />
              <span className="text-gongke-accent">{SITE.name}</span>
            </h1>
          </div>

          <h2 className="text-3xl font-display mb-2 text-foreground/80">
            探索发现最新、热门的智能体和AI工具
          </h2>

          <p className="my-6 text-gongke-muted max-w-3xl">{HERO_LEAD}</p>
        </div>
      </div>
    </section>
  );
}
