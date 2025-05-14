function paginate(array, page, limit) {
  const total = array.length; // 總資料筆數
  const totalPages = Math.ceil(total / limit); // 計算總頁數，向上取整

  // 防呆處理頁碼：
  // 1. 如果頁碼小於 1，就強制變成 1
  // 2. 如果頁碼超過總頁數，就強制變成總頁數
  // 3. 如果 totalPages 為 0（即無資料），則預設最少也會有第 1 頁，避免 slice 出現錯誤
  const currentPage = Math.max(1, Math.min(page, totalPages || 1));
  const skip = (currentPage - 1) * limit;
  const paginatedData = array.slice(skip, skip + limit);

  return {
    paginatedData,
    pagination: {
      page: currentPage,
      limit,
      total,
      total_pages: totalPages,
      has_next: currentPage < totalPages,
      has_previous: currentPage > 1,
    },
  };
}

module.exports = paginate;
