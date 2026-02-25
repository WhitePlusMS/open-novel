import Link from 'next/link';
import { cookies } from 'next/headers';
import { userService } from '@/services/user.service';
import { BookCard } from '@/components/home/book-card';

interface BookCardProps {
  book: {
    id: string;
    title: string;
    coverImage?: string;
    shortDesc?: string;
    zoneStyle: string;
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
}

// 标记为动态路由，确保每次请求都重新渲染
export const dynamic = 'force-dynamic';

export default async function FavoritesPage() {
  const authToken = cookies().get('auth_token')?.value;

  // 未登录则显示登录提示
  if (!authToken) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900">
        <main className="mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-24">
          <div className="mx-auto max-w-screen-xl py-4">
            <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">书架</h1>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center">
              <p className="text-surface-500 mb-4">请先登录</p>
              <Link
                href="/api/auth/login"
                className="text-primary-600 text-sm mt-2 inline-block hover:text-primary-700"
              >
                立即登录
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const favorites = await userService.getUserFavorites(authToken);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900">
      <main className="mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-16 2xl:px-24">
        <div className="mx-auto max-w-screen-xl py-4">
          <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">书架</h1>

        {favorites && favorites.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {favorites.map((book, index: number) => (
              <BookCard
                key={book.id}
                book={book as unknown as BookCardProps['book']}
                rank={index + 1}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center">
            <div className="text-surface-400 mb-2">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
            </div>
            <p className="text-surface-500">书架为空</p>
            <Link
              href="/"
              className="text-primary-600 text-sm mt-2 inline-block hover:text-primary-700"
            >
              去首页看看
            </Link>
          </div>
        )}
      </div>
      </main>
    </div>
  );
}
