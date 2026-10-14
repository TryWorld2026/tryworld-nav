import type { Metadata } from 'next';
import Link from 'next/link';
import { CategoryIcon } from '@/components/category-icon';
import { categoryCards } from '@/lib/data';
import { rgb, rgbAlpha } from '@/lib/utils';

/**
 * The origin's own `<title>`, description and keywords, harvested from
 * /categories rather than derived — the page copy is hand-written.
 */
export const metadata: Metadata = {
  title: '所有分类',
  description:
    '试界导航是专注于智能体和AI工具的门户网站，我们致力于为用户介绍最新、热门的智能体和AI工具，帮助用户快速找到适合自己的学习、工作、生活的AI利器。浏览我们的精选分类，找到适合您需求的智能体或AI工具。',
};

/**
 * The origin's category index, verbatim from its streamed `S:2` block.
 *
 * Each card is a link to the category holding a colour-tinted icon tile, the
 * category name and its hand-written tagline, then a strip of six member
 * avatars overlapping by `-space-x-4` and a black `+N` chip for the rest.
 *
 * The taglines, the six avatars per card and each `+N` count are harvested
 * (`data/category-cards.json`); none is derivable — the avatars are a curated
 * pick, not the category's first six in catalog order.
 */
export default function CategoriesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-grow flex">
        <div className="flex-1 py-8">
          <div className="px-4 md:px-8">
            <div className="">
              <h1 className="text-3xl md:text-4xl font-bold mb-4 font-display">所有分类</h1>
              <p className="text-gongke-muted text-lg mb-8">
                浏览我们的精选分类，找到适合您需求的智能体或AI工具。
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6 5xl:grid-cols-8 gap-6 mt-8">
              {categoryCards.map((c) => (
                <Link key={c.slug} href={`/categories/${c.slug}`} className="block group">
                  <div className="border border-foreground/5 rounded-lg p-6 bg-background hover:shadow-md transition-shadow">
                    <div className="flex items-start mb-4">
                      <div
                        className="w-12 h-12 aspect-square rounded-lg flex items-center justify-center mr-4"
                        style={{
                          // The origin tints the tile at 0.05, lighter than the
                          // sidebar's 0.2 — read off its inline style.
                          background: rgbAlpha(c.color, 0.05),
                          color: rgb(c.color),
                        }}
                      >
                        <CategoryIcon name={c.icon} className="h-5 w-5 md:h-6 md:w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg group-hover:text-gongke-accent transition-colors">
                          {c.name}
                        </h3>
                        <span className="inline-flex text-sm text-gongke-muted">{c.tagline}</span>
                      </div>
                    </div>
                    <div className="z-10 flex -space-x-4 rtl:space-x-reverse">
                      {c.members.map((m, i) => (
                        <Link
                          key={m.slug}
                          href={`/tools/${m.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            className="h-10 w-10 rounded-full border-2 bg-gray-50 border-white"
                            src={m.icon}
                            width={40}
                            height={40}
                            alt={`Avatar ${i + 1}`}
                          />
                        </Link>
                      ))}
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-black text-center text-xs font-medium text-white hover:bg-gray-600">
                        +{c.plus}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
