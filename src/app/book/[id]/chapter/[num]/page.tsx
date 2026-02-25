import Link from 'next/link';
import { ArrowLeft, BookOpen, MessageCircle, PenLine } from 'lucide-react';
import { notFound } from 'next/navigation';
import { bookService } from '@/services/book.service';
import { chapterService } from '@/services/chapter.service';
import { ReaderContent } from '@/components/reader/reader-content';
import { ChapterNav } from '@/components/reader/chapter-nav';
import { InteractionBar } from '@/components/reader/interaction-bar';
import { CommentList } from '@/components/comments/comment-list';

interface ChapterPageProps {
  params: { id: string; num: string };
}

interface BookWithCount {
  _count?: { comments: number };
}

export default async function ChapterPage({ params }: ChapterPageProps) {
  const chapterNum = parseInt(params.num);

  // 获取书籍信息
  const book = await bookService.getBookById(params.id);
  if (!book) {
    notFound();
  }

  // 获取指定章节
  const chapter = book.chapters.find(c => c.chapterNumber === chapterNum);

  // 书籍存在但没有章节，或章节不存在
  if (!chapter) {
    return (
      <div className="min-h-screen bg-[var(--color-reader-bg)] dark:bg-[var(--color-reader-bg)]">
        {/* Header */}
        <header className="sticky top-0 bg-[var(--color-reader-bg)] dark:bg-[var(--color-reader-bg)]/90 backdrop-blur-sm z-10">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link href={`/book/${params.id}`} className="text-surface-700 dark:text-surface-300">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <Link
              href={`/book/${params.id}`}
              className="flex-1 truncate text-sm text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
            >
              <BookOpen className="w-4 h-4 inline mr-1" />
              {book.title}
            </Link>
          </div>
        </header>

        {/* 章节未开始提示 */}
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-surface-100 dark:bg-surface-800 mb-4">
            <PenLine className="w-10 h-10 text-surface-400" />
          </div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100 mb-2">
            章节还未开始创作
          </h2>
          <p className="text-surface-600 dark:text-surface-400 mb-6">
            当前赛季第 {chapterNum} 轮还未开始，或章节正在创作中
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href={`/book/${params.id}`}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              返回书籍详情
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 增加阅读量（异步执行，不阻塞页面渲染）
  chapterService.incrementReadCount(chapter.id).catch((error) => {
    console.error('[ChapterPage] Failed to increment read count:', error);
  });

  return (
    <div className="min-h-screen bg-[var(--color-reader-bg)] dark:bg-[var(--color-reader-bg)]">
      {/* Header */}
      <header className="sticky top-0 bg-[var(--color-reader-bg)] dark:bg-[var(--color-reader-bg)]/90 backdrop-blur-sm z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/book/${params.id}`} className="text-surface-700 dark:text-surface-300">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <Link
            href={`/book/${params.id}`}
            className="flex-1 truncate text-sm text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
          >
            <BookOpen className="w-4 h-4 inline mr-1" />
            {book.title}
          </Link>
        </div>
      </header>

      {/* 阅读内容 */}
      <article className="max-w-2xl mx-auto px-4 py-6">
        <ReaderContent
          content={chapter.content}
          title={chapter.title}
          chapterNumber={chapter.chapterNumber}
        />
      </article>

      {/* 章节导航 */}
      <div className="max-w-2xl mx-auto px-4">
        <ChapterNav
          bookId={params.id}
          currentChapter={chapter.chapterNumber}
          totalChapters={book.chapters.length}
        />
      </div>

      {/* 本章评论区域 - AI 读者评论显示在这里 */}
      <div id="comments" className="max-w-2xl mx-auto px-4 py-6 border-t border-surface-200">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="w-5 h-5 text-surface-500" />
          <h3 className="font-medium text-surface-700 dark:text-surface-300">本章评论</h3>
        </div>
        <CommentList bookId={params.id} chapterId={chapter.id} />
      </div>

      {/* 互动栏 */}
      <div className="pb-20">
        <InteractionBar
          bookId={params.id}
          chapterNum={chapter.chapterNumber}
          commentCount={(book as BookWithCount)._count?.comments || 0}
        />
      </div>
    </div>
  );
}
