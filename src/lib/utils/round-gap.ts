export function buildRoundGapsFromBooks(
  books: Array<{ id: string; chapters: Array<{ chapterNumber: number }>; chaptersPlan: unknown }>,
  round: number
): Array<{ bookId: string; chapterNumber: number; gapType: 'OUTLINE' | 'CHAPTER' }> {
  const gaps: Array<{ bookId: string; chapterNumber: number; gapType: 'OUTLINE' | 'CHAPTER' }> = [];
  books.forEach((book) => {
    const existingChapterNumbers = new Set(book.chapters.map((c) => c.chapterNumber));
    const chaptersPlan = (book.chaptersPlan as unknown as Array<{ number: number }>) || [];
    const outlineChapterNumbers = new Set(chaptersPlan.map((c) => c.number));
    for (let i = 1; i <= round; i++) {
      if (!existingChapterNumbers.has(i)) {
        gaps.push({ bookId: book.id, chapterNumber: i, gapType: 'CHAPTER' });
      }
      if (!outlineChapterNumbers.has(i)) {
        gaps.push({ bookId: book.id, chapterNumber: i, gapType: 'OUTLINE' });
      }
    }
  });

  return gaps;
}
