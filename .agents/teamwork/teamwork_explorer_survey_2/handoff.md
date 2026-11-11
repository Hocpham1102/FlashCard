# Báo Cáo Handoff Khảo Sát Database & Prisma (Explorer 2)

## 1. Observation (Quan sát trực tiếp)

- **Lệnh chẩn đoán `npx prisma validate`**:
  - Chạy `npx prisma validate` không có biến môi trường báo lỗi P1012:
    ```text
    Error: Prisma schema validation - (get-config wasm)
    Error code: P1012
    error: Environment variable not found: DIRECT_URL.
      -->  prisma\schema.prisma:8
       | 
     7 |   url       = env("DATABASE_URL")
     8 |   directUrl = env("DIRECT_URL")
       | 
    ```
  - Khi thiết lập giả lập `$env:DATABASE_URL="postgresql://user:pass@localhost:5432/flashcard"; $env:DIRECT_URL="postgresql://user:pass@localhost:5432/flashcard"`, chạy `npx prisma validate` trả về: `The schema at prisma\schema.prisma is valid 🚀` (Exit code: 0).
  - Không tồn tại bất kỳ file `.env`, `.env.example`, hoặc `.env.local` nào trong thư mục gốc dự án (`Get-ChildItem -Path . -Filter *.env* -Force` trả về rỗng).

- **Lệnh sinh mã `prisma generate`**:
  - Chạy `node node_modules\prisma\build\index.js generate` thành công:
    ```text
    ✔ Generated Prisma Client (v5.22.0) to .\node_modules\@prisma\client in 216ms
    ```

- **Lệch pha Schema & Migration (`prisma/schema.prisma` vs `prisma/migrations/`)**:
  - Thư mục `prisma/migrations/` chỉ có duy nhất 1 thư mục con `20260424102124_add_user_role/migration.sql`.
  - `migration.sql` chỉ tạo đúng 6 bảng: `Deck`, `Card`, `Account`, `Session`, `User`, `VerificationToken`.
  - 6 model hoàn toàn vắng mặt trong migration: `CardReview`, `QuizSession`, `QuizAnswer`, `UserStats`, `Achievement`, `DailyActivity`.
  - Bảng `Deck` trong `migration.sql` thiếu 3 cột so với schema: `category`, `toeicParts`, `isPublic`.
  - Bảng `Card` trong `migration.sql` thiếu 10 cột so với schema: `phonetic`, `example`, `partOfSpeech`, `synonyms`, `antonyms`, `collocations`, `toeicPart`, `difficulty`, `audioUrl`, `lastReviewed`, và thiếu chỉ mục `Card_nextReview_idx`.
  - `README.md` (dòng 85) chỉ dẫn `npx prisma db push`, chứng tỏ dự án đang dùng `db push` và bỏ rơi hệ thống migration của Prisma.

- **Khởi tạo Prisma Client (`src/lib/prisma.ts`)**:
  - Dòng 9-18 gọi trực tiếp `prisma.$connect()` ở phạm vi top-level của module.
  - Khi chạy `npm run build`, Next.js thu thập page data và kích hoạt đoạn code này, in ra hơn 15 lần lỗi:
    ```text
    ❌ Failed to connect to Supabase database: PrismaClientInitializationError: error: Environment variable not found: DATABASE_URL.
    ```
  - `globalForPrisma.prisma = prisma` (dòng 20) chỉ lưu instance khi `NODE_ENV !== "production"`.

- **Quan sát kiến trúc dữ liệu và ORM**:
  - **Trạng thái Spaced Repetition (SRS)**: Trong `prisma/schema.prisma` (dòng 48-52), `easeFactor`, `interval`, `repetitions`, `nextReview`, `lastReviewed` nằm trực tiếp trên model `Card`. Khi User A ôn tập tại `src/app/api/cards/[id]/review/route.ts` (dòng 42-51), câu lệnh `prisma.card.update` thay đổi `nextReview` toàn cục, khiến User B không còn thẻ để ôn tập tại `GET /api/decks/[id]/study` (`where: { deckId: id, nextReview: { lte: new Date() } }`).
  - **Model `User` thiếu mốc thời gian**: `prisma/schema.prisma` (dòng 182-199) không có `createdAt` và `updatedAt`. Tại `src/app/api/admin/users/route.ts` (dòng 21) và `src/app/api/admin/stats/route.ts` (dòng 34), code phải `orderBy: { emailVerified: "desc" }`, vốn bằng `null` với mọi tài khoản đăng ký bằng mật khẩu.
  - **Khuyết Foreign Key & Index**:
    - `QuizAnswer` (dòng 95-107): `cardId String` không có quan hệ `@relation` với `Card` và không có chỉ mục `@@index([cardId])`.
    - `Account` và `Session`: `userId` không có `@@index([userId])`.
    - `Card`: thiếu composite index `@@index([deckId, nextReview])` cho query study.
  - **Lạm dụng trường `synonyms`**: Tại `src/app/api/decks/import-ai/route.ts` (dòng 272) và `src/app/api/quiz/generate/route.ts` (dòng 62-81), chuỗi JSON chứa các lựa chọn trắc nghiệm được lưu đè vào cột `synonyms`.
  - **Lỗ hổng bảo mật truy cập dữ liệu**:
    - `GET /api/decks/[id]/cards` và `POST /api/decks/[id]/cards` không có kiểm tra session hoặc quyền sở hữu deck.
    - `PUT /api/cards/[id]` và `DELETE /api/cards/[id]` không có kiểm tra session hoặc quyền sở hữu deck.
    - `POST /api/quiz/submit` nhận `isCorrect: boolean` trực tiếp từ client payload mà không đối chiếu với đáp án đúng trong DB trước khi cấp XP.
  - **Thiếu Transaction trong Gamification**: `src/lib/gamification.ts` (dòng 92-143) thực hiện `userStats.upsert` và `dailyActivity.upsert` tách biệt ngoài `prisma.$transaction`.
  - **Model chết**: `Achievement` (dòng 129-138) hoàn toàn không được tham chiếu trong bất kỳ file nào thuộc thư mục `src/`.
  - **Lỗi TypeScript**: Chạy `npx tsc --noEmit` gặp lỗi `TS2322` tại `src/app/api/user/stats/route.ts` (dòng 11) do dùng kiểu `Request` thay vì `NextRequest`.
  - **Che giấu lỗi trong cấu hình**: `next.config.mjs` bật `typescript.ignoreBuildErrors: true` và `eslint.ignoreDuringBuilds: true`.

---

## 2. Logic Chain (Chuỗi lập luận)

1. **Từ Observation 1 (lỗi P1012)**: Prisma CLI kiểm tra tính hợp lệ của toàn bộ datasource block, bao gồm sự tồn tại của các biến `env("DATABASE_URL")` và `env("DIRECT_URL")`. Do dự án không có file `.env` hoặc `.env.example`, bất kỳ môi trường CI hoặc máy lập trình viên mới nào chạy `npx prisma validate` cũng sẽ lập tức thất bại.
2. **Từ Observation 3 (so sánh schema vs migration)**: Thư mục migration chỉ phản ánh trạng thái sơ khai của cơ sở dữ liệu (6 bảng). 6 bảng chức năng cốt lõi (UserStats, DailyActivity, CardReview, QuizSession, QuizAnswer, Achievement) và 13 cột dữ liệu quan trọng hoàn toàn chỉ tồn tại trong file schema mà chưa từng được sinh migration. Do đó, việc deploy sản phẩm bằng `prisma migrate deploy` chắc chắn sẽ gây ra lỗi thiếu bảng trên production.
3. **Từ Observation 4 (eager connection trong `prisma.ts`)**: Việc đặt `prisma.$connect()` ở cấp module buộc Prisma phải mở kết nối ngay khi file `prisma.ts` được require/import. Vì Next.js import các route trong quá trình build tĩnh (`next build`), hành vi này kích hoạt lỗi kết nối hàng loạt khi chưa có DB, làm chậm cold-start và tiềm ẩn lỗi crash trong môi trường serverless.
4. **Từ Observation 5 (SRS trên bảng `Card`)**: Trong hệ thống đa người dùng, bộ thẻ có thể được chia sẻ (`isPublic = true`) hoặc được nhân bản. Việc gán trực tiếp thuộc tính tiến độ học của thuật toán SM-2 (`nextReview`, `interval`, `easeFactor`) vào thực thể `Card` là một sai lầm về mô hình hóa dữ liệu quan hệ, biến tiến độ cá nhân của người học trước thành trạng thái chung của tất cả người học sau.
5. **Từ Observation 5 (bảo mật route thẻ & quiz)**: Do các route `/api/cards/[id]` và `/api/decks/[id]/cards` thiếu middleware/session guard, bất kỳ yêu cầu HTTP nào cũng có thể đọc, sửa, xóa thẻ mà không phụ thuộc vào quyền sở hữu. Tương tự, việc tin tưởng `isCorrect` từ client trong `/api/quiz/submit` cho phép gian lận điểm số và XP tùy ý trong cơ sở dữ liệu.
6. **Từ Observation 5 (`synonyms` làm options trắc nghiệm)**: Sử dụng trường kiểu chuỗi đại diện cho từ đồng nghĩa để lưu chuỗi JSON các lựa chọn trắc nghiệm vi phạm tính toàn vẹn ngữ nghĩa (semantic integrity) và dẫn đến lỗi `SyntaxError` khi xử lý các thẻ thực sự có từ đồng nghĩa.

---

## 3. Caveats (Các điểm cần lưu ý & Giả định)

1. **Giả định về cơ sở dữ liệu Production/Dev**: Khảo sát được thực hiện ở chế độ Read-Only, không kết nối tới live Supabase instance thực tế của tác giả (do không có URL production trong repo). Kết luận về migration drift dựa trên đối chiếu mã nguồn file `prisma/migrations/20260424102124_add_user_role/migration.sql` với `prisma/schema.prisma`.
2. **Huy hiệu (Achievement)**: Không rõ tác giả dự kiến phát triển tính năng này trong tương lai hay đã bỏ dở. Hiện tại model này hoàn toàn là dead code trong schema.
3. **Mô hình SRS mở rộng**: Nếu tác giả chỉ thiết kế ứng dụng cho mục đích cá nhân học thẻ do chính mình tạo (mỗi user chỉ học deck của riêng mình), vấn đề SRS trên `Card` chưa bộc lộ lỗi ngay; tuy nhiên với sự xuất hiện của `isPublic` và Admin Portal, lỗ hổng này sẽ phát tác ngay khi chia sẻ bộ thẻ.

---

## 4. Conclusion (Kết luận)

Hệ thống cơ sở dữ liệu và tầng ORM Prisma của FlashCard hiện đang tồn tại **4 nhóm vấn đề nghiêm trọng**:
1. **Rủi ro triển khai & Tiêu chuẩn kiểm tra (Blocker)**: Lệnh `npx prisma validate` thất bại do thiếu file cấu hình mẫu `.env.example`; migration bị lệch pha nghiêm trọng so với schema (thiếu 6 bảng và 13 cột), phụ thuộc vào `prisma db push` không an toàn.
2. **Kiến trúc kết nối (High Risk)**: Lỗi eager top-level `$connect()` tại `src/lib/prisma.ts` làm ô nhiễm log build và gây rủi ro cold-start/timeout trong serverless.
3. **Mô hình hóa dữ liệu & Tính toàn vẹn (Critical)**: Thuật toán SRS gắn vào `Card` thay vì theo từng user; `QuizAnswer` thiếu Foreign Key và Index; `User` thiếu `createdAt`/`updatedAt`; nhồi JSON options vào cột `synonyms`.
4. **Bảo mật & Transaction (High Risk)**: Các thao tác CRUD thẻ thiếu kiểm tra quyền sở hữu; `POST /api/quiz/submit` tin tưởng client mù quáng; gamification thiếu transaction bảo đảm tính nguyên tử.

---

## 5. Verification Method (Phương pháp xác minh độc lập)

Để xác minh độc lập các phát hiện trên mà không cần sửa code, người tiếp nhận có thể chạy các lệnh sau từ thư mục gốc `e:\GitHub\FlashCard`:

1. **Xác minh lỗi `npx prisma validate` khi không có env**:
   ```powershell
   npx prisma validate
   ```
   *Kết quả mong đợi:* Báo lỗi P1012 `Environment variable not found: DIRECT_URL`.

2. **Xác minh `npx prisma validate` hợp lệ khi nạp đủ biến**:
   ```powershell
   $env:DATABASE_URL="postgresql://user:pass@localhost:5432/flashcard"; $env:DIRECT_URL="postgresql://user:pass@localhost:5432/flashcard"; npx prisma validate
   ```
   *Kết quả mong đợi:* Trả về `The schema at prisma\schema.prisma is valid 🚀`.

3. **Xác minh lệch pha migration (Schema drift)**:
   So sánh các model trong `prisma/schema.prisma` với file `prisma/migrations/20260424102124_add_user_role/migration.sql`:
   ```powershell
   Select-String -Path prisma\schema.prisma -Pattern "^model "
   Select-String -Path prisma\migrations\20260424102124_add_user_role\migration.sql -Pattern "CREATE TABLE"
   ```
   *Kết quả mong đợi:* `schema.prisma` có 12 model; `migration.sql` chỉ có 6 bảng.

4. **Xác minh spam log lỗi kết nối khi `npm run build`**:
   ```powershell
   npm run build
   ```
   *Kết quả mong đợi:* Thấy xuất hiện hơn 15 thông báo đỏ `❌ Failed to connect to Supabase database: PrismaClientInitializationError: error: Environment variable not found: DATABASE_URL`.

5. **Xác minh lỗi TypeScript**:
   ```powershell
   npx tsc --noEmit
   ```
   *Kết quả mong đợi:* Lỗi TS2322 tại `src/app/api/user/stats/route.ts:11`.

6. **Xác minh lỗ hổng bypass ESLint / TypeScript trong build**:
   Kiểm tra nội dung `next.config.mjs` có `ignoreBuildErrors: true` và `ignoreDuringBuilds: true`.
