import {
  AudioWaveform,
  BadgeJapaneseYen,
  Binoculars,
  BotMessageSquare,
  BrainCircuit,
  BriefcaseBusiness,
  ChartArea,
  Clapperboard,
  Compass,
  Cpu,
  Globe,
  GraduationCap,
  Headset,
  Image,
  Languages,
  Megaphone,
  Network,
  NotebookPen,
  PenTool,
  Presentation,
  Pyramid,
  Radar,
  Scale,
  Circle,
  ScrollText,
  SquareTerminal,
  TextCursorInput,
  type LucideIcon,
} from 'lucide-react';

const REGISTRY: Record<string, LucideIcon> = {
  'audio-waveform': AudioWaveform,
  'badge-japanese-yen': BadgeJapaneseYen,
  binoculars: Binoculars,
  'bot-message-square': BotMessageSquare,
  'brain-circuit': BrainCircuit,
  'briefcase-business': BriefcaseBusiness,
  'chart-area': ChartArea,
  clapperboard: Clapperboard,
  compass: Compass,
  cpu: Cpu,
  globe: Globe,
  'graduation-cap': GraduationCap,
  headset: Headset,
  image: Image,
  languages: Languages,
  megaphone: Megaphone,
  network: Network,
  'notebook-pen': NotebookPen,
  'pen-tool': PenTool,
  presentation: Presentation,
  pyramid: Pyramid,
  radar: Radar,
  scale: Scale,
  'scroll-text': ScrollText,
  'square-terminal': SquareTerminal,
  'text-cursor-input': TextCursorInput,
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  // 兜底从 `Sparkles` 换成 `Circle`。星形是「AI 通用装饰」的符号，用它表示
  // 「这个分类图标我们没登记」等于把一个无语义的装饰当占位符；圆点是中性的。
  // 26 个分类的图标名全部已在 REGISTRY 里，兜底只在数据漂移时才会走到。
  const Cmp = REGISTRY[name] ?? Circle;
  return <Cmp className={className} />;
}
