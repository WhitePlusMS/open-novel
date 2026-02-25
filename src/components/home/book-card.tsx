import Link from 'next/link';
import Image from 'next/image';
import { Flame, BookOpen, MessageCircle, Trophy, Medal, User } from 'lucide-react';
import { getZoneConfig } from '@/lib/utils/zone';

interface BookCardProps {
  book: {
    id: string;
    title: string;
    coverImage?: string;
    shortDesc?: string;
    zoneStyle: string;
    status?: 'ACTIVE' | 'COMPLETED' | 'DRAFT';
    heat: number;
    chapterCount: number;
    viewCount: number;
    commentCount: number;
    author: {
      nickname: string;
    };
    score?: {
      finalScore: number;
      avgRating: number;
    };
    seasonNumber?: number;
  };
  rank?: number;
  showSeason?: boolean;
}

// 状态配置
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  ACTIVE: { label: '连载中', bg: 'bg-green-500', text: 'text-white' },
  COMPLETED: { label: '已完结', bg: 'bg-blue-500', text: 'text-white' },
  DRAFT: { label: '草稿', bg: 'bg-gray-500', text: 'text-white' },
};

// 格式化数字
function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null) return '0';
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

/**
 * 书籍卡片组件 V2
 * 图标布局：左上排名 | 右上状态 | 左下类型 | 悬浮阅读按钮
 */
export function BookCard({ book, rank, showSeason = true }: BookCardProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _showSeason = showSeason;
  const zoneConfig = getZoneConfig(book.zoneStyle);
  const zoneStyle = zoneConfig
    ? { bg: zoneConfig.bg, text: zoneConfig.text, label: zoneConfig.label }
    : { bg: 'bg-gray-100', text: 'text-gray-600', label: book.zoneStyle };
  const status = book.status || 'ACTIVE';
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.ACTIVE;

  return (
    <Link href={`/book/${book.id}`}>
      <div className="group relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-gray-200 hover:-translate-y-2">
        {/* 封面区域 */}
        <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
          {book.coverImage ? (
            <Image
              src={book.coverImage}
              alt={book.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-100 via-primary-50 to-orange-50">
              <BookOpen className="h-16 w-16 text-primary-300" />
            </div>
          )}

          {/* 左上角：排名徽章（前3名） */}
          {rank && rank <= 3 && (
            <div className="absolute left-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg ring-2 ring-white/50">
              {rank === 1 ? <Trophy className="h-5 w-5" /> : <Medal className="h-5 w-5" />}
            </div>
          )}

          {/* 右上角：状态标签 */}
          <div className="absolute right-3 top-3 z-20">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold shadow-md backdrop-blur-sm ${statusConfig.bg} ${statusConfig.text}`}>
              {statusConfig.label}
            </span>
          </div>

          {/* 左下角：分区类型图标（半透明） */}
          <div className="absolute bottom-3 left-3 z-10">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${zoneStyle.bg} ${zoneStyle.text} opacity-90 shadow-sm`}>
              {zoneStyle.label}
            </span>
          </div>

          {/* 悬浮层：阅读按钮 */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-all duration-300 group-hover:opacity-100 z-30 backdrop-blur-sm">
            <button className="rounded-full bg-white/95 backdrop-blur-sm px-8 py-3 text-sm font-semibold text-gray-900 shadow-xl transition-all duration-200 hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2" aria-label={`阅读 ${book.title}`}>
              立即阅读
            </button>
          </div>
        </div>

        {/* 信息区域 */}
        <div className="p-4">
          {/* 标题 */}
          <h3 className="mb-1.5 line-clamp-1 text-lg font-bold text-gray-900 group-hover:text-primary-600 transition-colors">
            {book.title}
          </h3>

          {/* 作者 */}
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-400">
            <User className="h-4 w-4" />
            <span className="line-clamp-1">{book.author.nickname}</span>
          </div>

          {/* 简介 */}
          <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-gray-500">
            {book.shortDesc || '暂无简介'}
          </p>

          {/* 统计数据 */}
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              {book.chapterCount}章
            </span>
            <span className="flex items-center gap-1">
              <Flame className="h-4 w-4 text-orange-500" />
              {formatNumber(book.heat)}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              {book.commentCount}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
